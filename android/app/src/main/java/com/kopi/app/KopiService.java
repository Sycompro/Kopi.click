package com.kopi.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import org.java_websocket.client.WebSocketClient;
import org.java_websocket.handshake.ServerHandshake;
import org.json.JSONObject;
import java.net.URI;
import java.util.Timer;
import java.util.TimerTask;

public class KopiService extends Service {
    private static final String CHANNEL_ID = "KopiIndustrialServiceChannel";
    private static final String PREFS_NAME = "KopiIndustrialPrefs";
    private WebSocketClient railwayClient;
    private boolean isConnected = false;
    private String sedeId, token, railwayUrl;
    private Timer heartbeatTimer;
    private static KopiService instance;

    public static KopiService getInstance() {
        return instance;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        instance = this;
        createNotificationChannel();
        
        // Iniciar en primer plano inmediatamente para evitar el cierre por Android 14+
        Intent notificationIntent = new Intent(this, MainActivity.class);
        PendingIntent pendingIntent = PendingIntent.getActivity(this, 0, notificationIntent, 
            PendingIntent.FLAG_IMMUTABLE);

        Notification notification = new NotificationCompat.Builder(this, CHANNEL_ID)
                .setContentTitle("Kopi PRO GOLD Industrial")
                .setContentText("Motor de comunicación persistente activo")
                .setSmallIcon(android.R.drawable.stat_notify_sync)
                .setContentIntent(pendingIntent)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setSilent(true)
                .build();

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, notification, android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC);
        } else {
            startForeground(1, notification);
        }

        loadCredentials();
        sendServiceLog("Servicio Kopi iniciado correctamente");
        
        if (isValidConfig()) {
            connect();
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String action = intent.getAction();
            if ("CONNECT".equals(action)) {
                this.railwayUrl = intent.getStringExtra("url");
                this.sedeId = intent.getStringExtra("sedeId");
                this.token = intent.getStringExtra("token");
                saveCredentials(railwayUrl, sedeId, token);
                sendServiceLog("Recibida nueva configuración, conectando...");
                connect();
            } else if ("RECONNECT".equals(action)) {
                sendServiceLog("Forzando reconexión...");
                connect();
            }
        }
        return START_STICKY;
    }

    private void sendServiceLog(String msg) {
        Intent intent = new Intent("com.kopi.app.SERVICE_LOG");
        intent.putExtra("message", msg);
        intent.setPackage(getPackageName());
        sendBroadcast(intent);
    }

    private void saveCredentials(String url, String sedeId, String token) {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        SharedPreferences.Editor editor = prefs.edit();
        editor.putString("railwayUrl", url);
        editor.putString("sedeId", sedeId);
        editor.putString("token", token);
        editor.apply();
    }

    private void loadCredentials() {
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
        this.railwayUrl = prefs.getString("railwayUrl", null);
        this.sedeId = prefs.getString("sedeId", null);
        this.token = prefs.getString("token", null);
    }

    private boolean isValidConfig() {
        return railwayUrl != null && !railwayUrl.isEmpty() && 
               sedeId != null && !sedeId.isEmpty() && 
               token != null && !token.isEmpty();
    }

    private void connect() {
        if (!isValidConfig()) {
            sendServiceLog("Configuración incompleta, esperando credenciales...");
            return;
        }

        if (railwayClient != null) {
            try { railwayClient.close(); } catch (Exception e) {}
        }

        sendServiceLog("Conectando a Railway: " + railwayUrl);

        try {
            railwayClient = new WebSocketClient(new URI(railwayUrl)) {
                @Override
                public void onOpen(ServerHandshake handshakedata) {
                    isConnected = true;
                    sendServiceLog("¡CONEXIÓN EXITOSA con Railway!");
                    try {
                        JSONObject reg = new JSONObject();
                        reg.put("action", "register");
                        reg.put("sedeId", sedeId);
                        reg.put("token", token);
                        reg.put("role", "tablet");
                        send(reg.toString());
                        sendServiceLog("Registro de Sede " + sedeId + " enviado.");
                    } catch (Exception e) {
                        sendServiceLog("Error al construir registro: " + e.getMessage());
                    }
                    startHeartbeat();
                    broadcastStatus();
                }

                @Override
                public void onMessage(String message) {
                    handleRailwayInternalMessage(message);
                    Intent intent = new Intent("com.kopi.app.RAILWAY_MESSAGE");
                    intent.putExtra("message", message);
                    intent.setPackage(getPackageName());
                    sendBroadcast(intent);
                }

                @Override
                public void onClose(int code, String reason, boolean remote) {
                    isConnected = false;
                    sendServiceLog("Conexión perdida con Railway (Código: " + code + "). Reintentando en 5s...");
                    broadcastStatus();
                    stopHeartbeat();
                    new Timer().schedule(new TimerTask() {
                        @Override
                        public void run() { connect(); }
                    }, 5000);
                }

                @Override
                public void onError(Exception ex) {
                    isConnected = false;
                    sendServiceLog("ERROR de conexión Railway: " + ex.getMessage());
                    broadcastStatus();
                }
            };
            railwayClient.connect();
        } catch (Exception e) {
            sendServiceLog("Error crítico al iniciar cliente: " + e.getMessage());
        }
    }

    private void handleRailwayInternalMessage(String message) {
        try {
            JSONObject json = new JSONObject(message);
            if (json.has("action") && json.getString("action").equals("pcStatus")) {
                boolean pc = json.getBoolean("connected");
                sendServiceLog("PC Bridge detectado por Railway: " + (pc ? "ONLINE" : "OFFLINE"));
            }
        } catch (Exception e) {}
    }

    public boolean isConnected() {
        return isConnected && railwayClient != null && railwayClient.isOpen();
    }

    public void sendToRailway(String message) {
        if (isConnected()) {
            railwayClient.send(message);
        }
    }

    private void startHeartbeat() {
        stopHeartbeat();
        heartbeatTimer = new Timer();
        heartbeatTimer.scheduleAtFixedRate(new TimerTask() {
            @Override
            public void run() {
                if (isConnected()) {
                    try {
                        JSONObject ping = new JSONObject();
                        ping.put("action", "ping");
                        railwayClient.send(ping.toString());
                    } catch (Exception e) {}
                }
            }
        }, 10000, 10000);
    }

    private void stopHeartbeat() {
        if (heartbeatTimer != null) {
            heartbeatTimer.cancel();
            heartbeatTimer = null;
        }
    }

    private void broadcastStatus() {
        Intent intent = new Intent("com.kopi.app.CONNECTION_STATUS");
        intent.putExtra("connected", isConnected);
        intent.setPackage(getPackageName());
        sendBroadcast(intent);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel serviceChannel = new NotificationChannel(
                    CHANNEL_ID,
                    "Kopi Industrial Service Channel",
                    NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(serviceChannel);
            }
        }
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    @Override
    public void onDestroy() {
        super.onDestroy();
        stopHeartbeat();
        if (railwayClient != null) railwayClient.close();
    }
}
