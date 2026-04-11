import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs';

const execAsync = promisify(exec);

/**
 * USBPrinter — Impresión raw directa a impresoras USB en Windows.
 * Envía datos binarios directamente al puerto de la impresora,
 * sin pasar por el driver del sistema (impresión raw/directa).
 */
export class USBPrinter {

    /**
     * Envía datos raw a una impresora por nombre.
     * Usa el comando `print` de Windows o copy directo al puerto.
     * 
     * @param printerName - Nombre exacto de la impresora en el sistema
     * @param data - Datos raw (ESC/POS, ZPL, etc.) como Buffer o string
     */
    async printRaw(printerName: string, data: Buffer | string): Promise<void> {
        if (process.platform !== 'win32') {
            throw new Error('USBPrinter actualmente solo soporta Windows');
        }

        const buffer = typeof data === 'string' ? Buffer.from(data, 'binary') : data;
        await this.printViaWindows(printerName, buffer);
    }

    /**
     * Impresión raw en Windows usando PowerShell + .NET interop.
     * Esto permite enviar raw data directamente al spooler de Windows.
     * v1.2.3: Implementa ejecución vía archivo temporal para mayor robustez.
     */
    private async printViaWindows(printerName: string, data: Buffer): Promise<void> {
        const base64Data = data.toString('base64');
        const escapedName = printerName.replace(/'/g, "''");

        // Definimos el script PowerShell limpio con saltos de línea reales
        const psScript = [
            `$ErrorActionPreference = 'Stop'`,
            `$printerName = '${escapedName}'`,
            `$data = [System.Convert]::FromBase64String('${base64Data}')`,
            ``,
            `Add-Type -TypeDefinition @'`,
            `using System;`,
            `using System.IO;`,
            `using System.Runtime.InteropServices;`,
            ``,
            `public class RawPrinterHelper`,
            `{`,
            `    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]`,
            `    public class DOCINFOA`,
            `    {`,
            `        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;`,
            `        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;`,
            `        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;`,
            `    }`,
            ``,
            `    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]`,
            `    public static extern bool OpenPrinter([MarshalAs(UnmanagedType.LPStr)] string szPrinter, out IntPtr hPrinter, IntPtr pd);`,
            ``,
            `    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]`,
            `    public static extern bool ClosePrinter(IntPtr hPrinter);`,
            ``,
            `    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]`,
            `    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);`,
            ``,
            `    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]`,
            `    public static extern bool EndDocPrinter(IntPtr hPrinter);`,
            ``,
            `    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]`,
            `    public static extern bool StartPagePrinter(IntPtr hPrinter);`,
            ``,
            `    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]`,
            `    public static extern bool EndPagePrinter(IntPtr hPrinter);`,
            ``,
            `    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]`,
            `    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);`,
            ``,
            `    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes)`,
            `    {`,
            `        IntPtr hPrinter = IntPtr.Zero;`,
            `        DOCINFOA di = new DOCINFOA();`,
            `        di.pDocName = "Kopi RAW Document";`,
            `        di.pDataType = "RAW";`,
            `        bool bSuccess = false;`,
            ``,
            `        if (OpenPrinter(szPrinterName.Normalize(), out hPrinter, IntPtr.Zero))`,
            `        {`,
            `            if (StartDocPrinter(hPrinter, 1, di))`,
            `            {`,
            `                if (StartPagePrinter(hPrinter))`,
            `                {`,
            `                    IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);`,
            `                    Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);`,
            `                    int dwWritten;`,
            `                    bSuccess = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out dwWritten);`,
            `                    EndPagePrinter(hPrinter);`,
            `                    Marshal.FreeCoTaskMem(pUnmanagedBytes);`,
            `                }`,
            `                EndDocPrinter(hPrinter);`,
            `            }`,
            `            ClosePrinter(hPrinter);`,
            `        }`,
            `        return bSuccess;`,
            `    }`,
            `}`,
            `'@ -ReferencedAssemblies System.Runtime.InteropServices`,
            ``,
            `$result = [RawPrinterHelper]::SendBytesToPrinter($printerName, $data)`,
            `if (-not $result) { throw "Error enviando datos raw a la impresora: $printerName" }`,
            `Write-Output "OK"`
        ].join('\r\n');

        const tempDir = path.join(process.cwd(), 'temp');
        if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

        const tempScript = path.join(tempDir, `print_${Date.now()}.ps1`);

        try {
            // Escribir script con encoding correcto (BOM para PowerShell si es necesario, pero UTF8 suele bastar)
            fs.writeFileSync(tempScript, psScript, 'utf8');

            const { stdout, stderr } = await execAsync(
                `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScript}"`,
                { timeout: 30000, maxBuffer: 1024 * 1024 * 10 }
            );

            if (stderr && !stderr.includes('WARNING')) {
                throw new Error(stderr);
            }

            console.log(`[Kopi] Impresión USB v1.2.3 enviada exitosamente a: ${printerName}`);
        } catch (err: any) {
            throw new Error(`Error en motor industrial: ${err.message}`);
        } finally {
            // Limpieza atómica
            if (fs.existsSync(tempScript)) {
                try { fs.unlinkSync(tempScript); } catch (e) { }
            }
        }
    }
}
