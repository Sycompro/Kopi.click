package com.kopi.app;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import com.getcapacitor.JSObject;
import com.getcapacitor.JSArray;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import android.Manifest;
import com.getcapacitor.PermissionState;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import org.json.JSONObject;
import org.json.JSONArray;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.CountDownLatch;

@CapacitorPlugin(
    name = "Kopi",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class KopiPlugin extends Plugin {

    private QZWebSocketServer qzServer;
    private KopiHttpServer httpServer;
    private java.util.List<String> logs = new java.util.ArrayList<>();
    private boolean railwayConnected = false;
    private boolean pcConnected = false;
    private ConcurrentHashMap<String, PendingRequest> pendingRequests = new ConcurrentHashMap<>();
    private String currentSedeId = "";
    private String currentToken = "";
    private String currentRailwayUrl = "";
    
    private static class PendingRequest {
        CountDownLatch latch = new CountDownLatch(1);
        String response = null;
    }

    private final BroadcastReceiver serviceReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getAction();
            if ("com.kopi.app.CONNECTION_STATUS".equals(action)) {
                railwayConnected = intent.getBooleanExtra("connected", false);
                if (!railwayConnected) pcConnected = false;
                notifyConnectionStatus(railwayConnected, pcConnected);
            } else if ("com.kopi.app.RAILWAY_MESSAGE".equals(action)) {
                handleRailwayMessage(intent.getStringExtra("message"));
            } else if ("com.kopi.app.SERVICE_LOG".equals(action)) {
                addLog("[SERVICE] " + intent.getStringExtra("message"));
            }
        }
    };

    @Override
    public void load() {
        try {
            addLog("Iniciando motor Kopi Industrial v2.6.6...");
            
            // Registrar receptores con flags de seguridad
            IntentFilter filter = new IntentFilter();
            filter.addAction("com.kopi.app.CONNECTION_STATUS");
            filter.addAction("com.kopi.app.RAILWAY_MESSAGE");
            filter.addAction("com.kopi.app.SERVICE_LOG");
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.TIRAMISU) {
                getContext().registerReceiver(serviceReceiver, filter, Context.RECEIVER_NOT_EXPORTED);
            } else {
                getContext().registerReceiver(serviceReceiver, filter);
            }

            // Iniciar servidores locales con captura de errores
            try {
                qzServer = new QZWebSocketServer(8181, this);
                qzServer.start();
                addLog("Servidor QZ (8181) iniciado.");
            } catch (Exception e) { addLog("Fallo Servidor QZ: " + e.getMessage()); }
            
            try {
                httpServer = new KopiHttpServer(5173, this);
                httpServer.start();
                addLog("Servidor HTTP (5173) iniciado.");
            } catch (Exception e) { addLog("Fallo Servidor HTTP: " + e.getMessage()); }
            
            setupWebView();

            // Solicitar estado inicial al servicio si ya existe
            KopiService service = KopiService.getInstance();
            if (service != null) {
                railwayConnected = service.isConnected();
                addLog("Estado de servicio sincronizado.");
            }
        } catch (Exception e) {
            addLog("ERROR crítico en load(): " + e.getMessage());
            e.printStackTrace();
        }
    }

    private void setupWebView() {
        if (getActivity() == null) return;
        getActivity().runOnUiThread(() -> {
            try {
                if (getBridge() == null || getBridge().getWebView() == null) return;
                android.webkit.WebView webView = getBridge().getWebView();
                webView.getSettings().setDomStorageEnabled(true);
                webView.getSettings().setJavaScriptEnabled(true);
                webView.getSettings().setMixedContentMode(android.webkit.WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
                webView.addJavascriptInterface(new KopiJSBridge(), "KopiNative");
                
                webView.setWebViewClient(new android.webkit.WebViewClient() {
                    @Override
                    public void onPageFinished(android.webkit.WebView view, String url) {
                        if (url.contains("mozo.pe")) {
                            injectScriptLocally(view);
                        }
                    }
                });
            } catch (Exception e) { addLog("Error en setupWebView: " + e.getMessage()); }
        });
    }

    private void handleRailwayMessage(String message) {
        try {
            JSONObject json = new JSONObject(message);
            if (json.has("status") && json.getString("status").equals("registered")) {
                railwayConnected = true;
                notifyConnectionStatus(true, pcConnected);
            } else if (json.has("action") && json.getString("action").equals("pcStatus")) {
                pcConnected = json.getBoolean("connected");
                notifyConnectionStatus(railwayConnected, pcConnected);
            } else if (json.has("from") && json.getString("from").equals("pc")) {
                JSONObject payload = json.optJSONObject("payload");
                if (payload == null) return;
                
                String type = payload.optString("type", "");
                if (type.equals("printers_list") || type.equals("entity_manifest")) {
                    pcConnected = true;
                    notifyConnectionStatus(railwayConnected, true);
                    
                    if (type.equals("printers_list")) {
                        JSONArray printersArray = payload.getJSONArray("printers");
                        JSArray jsArray = new JSArray();
                        for (int i = 0; i < printersArray.length(); i++) jsArray.put(printersArray.getString(i));
                        JSObject info = new JSObject();
                        info.put("printers", jsArray);
                        notifyListeners("kopiPcInfo", info);
                    }
                }

                if (json.has("uid")) {
                    String uid = json.getString("uid");
                    PendingRequest pending = pendingRequests.get(uid);
                    if (pending != null) {
                        pending.response = payload.toString();
                        pending.latch.countDown();
                    }
                }
            }
        } catch (Exception e) {
            addLog("Error mensaje: " + e.getMessage());
        }
    }

    private class KopiJSBridge {
        @android.webkit.JavascriptInterface
        public String sendToQZ(String message) {
            if (!railwayConnected) return "{\"result\":null,\"error\":\"Sin conexión Railway\"}";
            
            try {
                JSONObject json = new JSONObject(message);
                String uid = json.getString("uid");
                PendingRequest pending = new PendingRequest();
                pendingRequests.put(uid, pending);
                
                JSONObject forward = new JSONObject();
                forward.put("action", "forward");
                forward.put("uid", uid);
                forward.put("payload", json);
                
                // Enviar mediante el servicio
                KopiService service = KopiService.getInstance();
                if (service != null && service.isConnected()) {
                    service.sendToRailway(forward.toString());
                } else {
                    return "{\"result\":null,\"error\":\"Servicio Kopi no activo\"}";
                }
                
                boolean received = pending.latch.await(5, TimeUnit.SECONDS);
                pendingRequests.remove(uid);
                return (received && pending.response != null) ? pending.response : "{\"result\":null,\"error\":\"Timeout PC\"}";
            } catch (Exception e) {
                return "{\"result\":null,\"error\":\"" + e.getMessage() + "\"}";
            }
        }
        
        @android.webkit.JavascriptInterface
        public boolean isConnected() { return railwayConnected; }
    }

    @PluginMethod
    public void connectRailway(PluginCall call) {
        String url = call.getString("railwayUrl");
        String sedeId = call.getString("sedeId");
        String token = call.getString("token");
        
        if (url == null || sedeId == null || token == null) {
            call.reject("Faltan parámetros");
            return;
        }

        this.currentRailwayUrl = url;
        this.currentSedeId = sedeId;
        this.currentToken = token;

        Intent intent = new Intent(getContext(), KopiService.class);
        intent.setAction("CONNECT");
        intent.putExtra("url", url);
        intent.putExtra("sedeId", sedeId);
        intent.putExtra("token", token);
        
        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
            getContext().startForegroundService(intent);
        } else {
            getContext().startService(intent);
        }
        call.resolve();
    }

    @PluginMethod
    public void getStatus(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("railwayConnected", railwayConnected);
        ret.put("pcConnected", pcConnected);
        JSObject config = new JSObject();
        config.put("sedeId", currentSedeId);
        config.put("railwayUrl", currentRailwayUrl);
        ret.put("config", config);
        call.resolve(ret);
    }

    @PluginMethod
    public void requestNotificationPermission(PluginCall call) {
        if (android.os.Build.VERSION.SDK_INT < android.os.Build.VERSION_CODES.TIRAMISU) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
            return;
        }
        
        if (getPermissionState("notifications") == PermissionState.GRANTED) {
            JSObject ret = new JSObject();
            ret.put("status", "granted");
            call.resolve(ret);
        } else {
            requestPermissionForAlias("notifications", call, "notificationCallback");
        }
    }

    @PermissionCallback
    private void notificationCallback(PluginCall call) {
        JSObject ret = new JSObject();
        ret.put("status", getPermissionState("notifications"));
        call.resolve(ret);
    }

    @PluginMethod
    public void getLogs(PluginCall call) {
        JSObject ret = new JSObject();
        JSArray logArray = new JSArray();
        for (String log : logs) logArray.put(log);
        ret.put("logs", logArray);
        call.resolve(ret);
    }

    public void addLog(String msg) {
        if (msg == null) return;
        
        // Filtro de ruido: Ignorar logs internos de Capacitor y llamadas de polling
        if (msg.contains("%cnative") || msg.contains("%cresult") || 
            msg.contains("Kopi.getLogs") || msg.contains("Kopi.getStatus") ||
            msg.contains("console.groupEnd") || msg.contains("[object Object]")) {
            return;
        }

        String logEntry = "[" + new java.text.SimpleDateFormat("HH:mm:ss").format(new java.util.Date()) + "] " + msg;
        logs.add(logEntry);
        if (logs.size() > 100) logs.remove(0);
    }

    private void notifyConnectionStatus(boolean railway, boolean pc) {
        getActivity().runOnUiThread(() -> {
            String script = String.format("window.dispatchEvent(new CustomEvent('kopiConnectionStatus', {detail: {railway: %b, pc: %b}}));", railway, pc);
            getBridge().getWebView().evaluateJavascript(script, null);
        });
    }

    private void injectScriptLocally(android.webkit.WebView webView) {
        String script = "(function() { " +
            "if(window.qz) return; " +
            "var qz=(function(){ " +
            "  var _connected=false; " +
            "  function sendMessage(call,params){ " +
            "    return new Promise(function(resolve,reject){ " +
            "      var uid='kopi-'+Date.now(); " +
            "      var msg=JSON.stringify({uid:uid,call:call,params:params||{}}); " +
            "      var res=window.KopiNative.sendToQZ(msg); " +
            "      var json=JSON.parse(res); " +
            "      if(json.error) reject(new Error(json.error)); else resolve(json.result); " +
            "    }); " +
            "  } " +
            "  return { " +
            "    websocket: { connect: function(){ return Promise.resolve(); }, isActive: function(){ return window.KopiNative.isConnected(); } }, " +
            "    printers: { getList: function(){ return sendMessage('printers.getList'); } }, " +
            "    print: function(config,data){ return sendMessage('print',{config:config,data:data}); }, " +
            "    api: { getVersion: function(){ return Promise.resolve('2.2.4'); } } " +
            "  }; " +
            "})(); " +
            "window.qz = qz; " +
            "})();";
        webView.evaluateJavascript(script, null);
    }

    @Override
    protected void handleOnDestroy() {
        try { getContext().unregisterReceiver(serviceReceiver); } catch (Exception e) {}
        if (qzServer != null) try { qzServer.stop(); } catch (Exception e) {}
        if (httpServer != null) httpServer.stop();
    }

    public void handleNativePrint(JSONObject params) {
        addLog("Petición de impresión recibida de Mozo.pe");
    }
}
