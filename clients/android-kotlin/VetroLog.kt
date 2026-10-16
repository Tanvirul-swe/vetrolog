package com.vetrolog.client

import android.content.Context
import android.content.SharedPreferences
import android.os.Build
import android.os.Handler
import android.os.Looper
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener
import org.json.JSONArray
import org.json.JSONObject
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.TimeUnit

/**
 * VetroLog Mobile Database Inspector Client for Native Android (Kotlin/Java)
 *
 * Connects via WebSocket to the VetroLog desktop app (ws://<host>:9222/ws)
 * and streams SQLite / Room and SharedPreferences schemas, data, and live mutations.
 */
class VetroLog private constructor() {

    companion object {
        @Volatile
        private var instance: VetroLog? = null

        @JvmStatic
        fun getInstance(): VetroLog = instance ?: synchronized(this) {
            instance ?: VetroLog().also { instance = it }
        }

        @JvmStatic
        fun init(
            context: Context,
            host: String = "localhost",
            port: Int = 9222,
            appName: String? = null
        ) {
            val client = getInstance()
            client.context = context.applicationContext
            client.host = host
            client.port = port
            client.appName = appName ?: context.packageName
            client.connect()
        }

        @JvmStatic
        fun connectFromQr(context: Context, scannedData: String) {
            val client = getInstance()
            client.context = context.applicationContext
            val trimmed = scannedData.trim()
            try {
                if (trimmed.startsWith("vetrolog://")) {
                    val uri = android.net.Uri.parse(trimmed)
                    val urlParam = uri.getQueryParameter("url")
                    if (!urlParam.isNullOrEmpty()) {
                        client.connectToUrl(urlParam)
                        return
                    }
                    val hostParam = uri.getQueryParameter("host")
                    val portParam = uri.getQueryParameter("port")?.toIntOrNull() ?: 9222
                    if (!hostParam.isNullOrEmpty()) {
                        init(context, host = hostParam, port = portParam)
                        return
                    }
                } else if (trimmed.startsWith("{")) {
                    val json = JSONObject(trimmed)
                    val wsUrl = json.optString("wsUrl")
                    if (wsUrl.isNotEmpty()) {
                        client.connectToUrl(wsUrl)
                        return
                    }
                    val h = json.optString("host")
                    val p = json.optInt("port", 9222)
                    if (h.isNotEmpty()) {
                        init(context, host = h, port = p)
                        return
                    }
                } else if (trimmed.startsWith("ws://") || trimmed.startsWith("wss://")) {
                    client.connectToUrl(trimmed)
                    return
                }
            } catch (_: Exception) {}
        }
    }

    fun connectToUrl(url: String) {
        try {
            val uri = java.net.URI(url)
            host = uri.host ?: "localhost"
            port = if (uri.port > 0) uri.port else 9222
            connect()
        } catch (_: Exception) {}
    }

    private var context: Context? = null
    private var host: String = "localhost"
    private var port: Int = 9222
    private var appName: String = "Android App"
    private var deviceId: String = "android_${Build.MANUFACTURER}_${Build.MODEL}_${System.currentTimeMillis()}"

    private var webSocket: WebSocket? = null
    private val httpClient = OkHttpClient.Builder()
        .readTimeout(0, TimeUnit.MILLISECONDS)
        .build()

    private val mainHandler = Handler(Looper.getMainLooper())
    private var isConnected = false
    private var shouldReconnect = true

    // Registered databases and handlers
    private val databases = ArrayList<JSONObject>()
    private val tableDataProviders = ConcurrentHashMap<String, (table: String, page: Int, size: Int) -> List<Map<String, Any?>>>()
    private val queryExecutors = ConcurrentHashMap<String, (query: String) -> List<Map<String, Any?>>>()
    private val spListeners = ConcurrentHashMap<String, SharedPreferences.OnSharedPreferenceChangeListener>()

    /**
     * Connect or reconnect to the VetroLog Desktop server
     */
    fun connect() {
        shouldReconnect = true
        disconnectInternal()

        val url = "ws://$host:$port/ws"
        val request = Request.Builder().url(url).build()

        webSocket = httpClient.newWebSocket(request, object : WebSocketListener() {
            override fun onOpen(ws: WebSocket, response: Response) {
                isConnected = true
                sendHandshake()
                sendDatabaseList()
            }

            override fun onMessage(ws: WebSocket, text: String) {
                handleIncomingMessage(text)
            }

            override fun onFailure(ws: WebSocket, t: Throwable, response: Response?) {
                handleDisconnect()
            }

            override fun onClosed(ws: WebSocket, code: Int, reason: String) {
                handleDisconnect()
            }
        })
    }

    private fun handleDisconnect() {
        isConnected = false
        webSocket = null
        if (shouldReconnect) {
            mainHandler.postDelayed({
                if (shouldReconnect && !isConnected) {
                    connect()
                }
            }, 3000)
        }
    }

    private fun disconnectInternal() {
        webSocket?.close(1000, "Reconnecting")
        webSocket = null
        isConnected = false
    }

    private fun sendEnvelope(type: String, payload: Any) {
        if (!isConnected || webSocket == null) return

        try {
            val root = JSONObject()
            root.put("type", type)
            root.put("timestamp", System.currentTimeMillis())

            when (payload) {
                is JSONObject -> root.put("payload", payload)
                is JSONArray -> root.put("payload", payload)
                is Map<*, *> -> root.put("payload", JSONObject(payload))
                is List<*> -> root.put("payload", JSONArray(payload))
                else -> root.put("payload", payload)
            }

            webSocket?.send(root.toString())
        } catch (_: Exception) {}
    }

    private fun sendHandshake() {
        val payload = JSONObject().apply {
            put("id", deviceId)
            put("name", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("platform", "android")
            put("osVersion", "Android ${Build.VERSION.RELEASE} (API ${Build.VERSION.SDK_INT})")
            put("appId", appName)
            put("connectedAt", System.currentTimeMillis())
        }
        sendEnvelope("handshake", payload)
    }

    private fun sendDatabaseList() {
        val array = JSONArray()
        synchronized(databases) {
            for (db in databases) {
                array.put(db)
            }
        }
        sendEnvelope("db_list", array)
    }

    /**
     * Register an SQLite or Room database with its schema
     */
    fun registerDatabase(
        id: String,
        name: String,
        type: String = "sqlite",
        path: String,
        tables: List<Map<String, Any?>>,
        onFetchTableData: ((table: String, page: Int, size: Int) -> List<Map<String, Any?>>)? = null,
        onExecuteQuery: ((query: String) -> List<Map<String, Any?>>)? = null
    ) {
        synchronized(databases) {
            val iterator = databases.iterator()
            while (iterator.hasNext()) {
                if (iterator.next().optString("id") == id) {
                    iterator.remove()
                }
            }

            val dbJson = JSONObject().apply {
                put("id", id)
                put("name", name)
                put("type", type)
                put("path", path)
                put("sizeBytes", 0)
                put("updatedAt", System.currentTimeMillis())
                put("tables", JSONArray(tables.map { JSONObject(it) }))
            }
            databases.add(dbJson)
        }

        if (onFetchTableData != null) tableDataProviders[id] = onFetchTableData
        if (onExecuteQuery != null) queryExecutors[id] = onExecuteQuery

        sendDatabaseList()
    }

    /**
     * Automatically registers and inspects a SharedPreferences file
     */
    fun registerSharedPreferences(name: String) {
        val ctx = context ?: return
        val sp = ctx.getSharedPreferences(name, Context.MODE_PRIVATE)
        val id = "sp_$name"

        val tableSchema = mapOf(
            "name" to "preferences",
            "rowCount" to sp.all.size,
            "columns" to listOf(
                mapOf("name" to "key", "type" to "TEXT", "isPrimaryKey" to true),
                mapOf("name" to "type", "type" to "TEXT", "isPrimaryKey" to false),
                mapOf("name" to "value", "type" to "TEXT", "isPrimaryKey" to false)
            )
        )

        registerDatabase(
            id = id,
            name = "$name (SharedPrefs)",
            type = "shared_preferences",
            path = "/data/data/${ctx.packageName}/shared_prefs/$name.xml",
            tables = listOf(tableSchema),
            onFetchTableData = { _, _, _ ->
                sp.all.map { (k, v) ->
                    mapOf(
                        "key" to k,
                        "type" to (v?.javaClass?.simpleName ?: "null"),
                        "value" to (v?.toString() ?: "null")
                    )
                }
            }
        )

        // Listen for live preferences changes
        val listener = SharedPreferences.OnSharedPreferenceChangeListener { sharedPreferences, key ->
            if (key != null) {
                val newVal = sharedPreferences.all[key]
                notifyMutation(
                    databaseId = id,
                    tableName = "preferences",
                    type = if (newVal != null) "UPDATE" else "DELETE",
                    newValues = if (newVal != null) mapOf("key" to key, "value" to newVal.toString()) else null,
                    oldValues = if (newVal == null) mapOf("key" to key) else null
                )
            }
        }
        spListeners[id] = listener
        sp.registerOnSharedPreferenceChangeListener(listener)
    }

    /**
     * Emit a live mutation event (e.g. after Room / SQLite INSERT, UPDATE, DELETE)
     */
    fun notifyMutation(
        databaseId: String,
        tableName: String,
        type: String, // INSERT, UPDATE, DELETE
        query: String? = null,
        durationMs: Double? = null,
        oldValues: Map<String, Any?>? = null,
        newValues: Map<String, Any?>? = null,
        affected: Int = 1
    ) {
        val payload = JSONObject().apply {
            put("id", "mut_${System.currentTimeMillis()}")
            put("databaseId", databaseId)
            put("tableName", tableName)
            put("type", type.uppercase())
            put("timestamp", System.currentTimeMillis())
            query?.let { put("query", it) }
            durationMs?.let { put("durationMs", it) }
            oldValues?.let { put("oldValues", JSONObject(it)) }
            newValues?.let { put("newValues", JSONObject(it)) }
            put("affected", affected)
        }

        sendEnvelope("mutation", payload)
    }

    private fun handleIncomingMessage(raw: String) {
        try {
            val envelope = JSONObject(raw)
            val action = envelope.optString("action")
            val reqId = envelope.optString("requestId")
            val payload = envelope.optJSONObject("payload") ?: return

            when (action) {
                "fetch_table_data" -> {
                    val dbId = payload.getString("databaseId")
                    val tableName = payload.getString("tableName")
                    val page = payload.optInt("page", 1)
                    val pageSize = payload.optInt("pageSize", 50)

                    val provider = tableDataProviders[dbId]
                    if (provider != null) {
                        val rows = provider(tableName, page, pageSize)
                        val resp = JSONObject().apply {
                            put("databaseId", dbId)
                            put("tableName", tableName)
                            put("totalRows", rows.size)
                            put("page", page)
                            put("pageSize", pageSize)
                            put("columns", JSONArray())
                            put("rows", JSONArray(rows.map { JSONObject(it) }))
                        }
                        sendEnvelope("table_data", resp)
                    }
                }
                "execute_query" -> {
                    val dbId = payload.getString("databaseId")
                    val sql = payload.getString("query")
                    val executor = queryExecutors[dbId]

                    val start = System.nanoTime()
                    if (executor != null) {
                        try {
                            val rows = executor(sql)
                            val elapsedMs = (System.nanoTime() - start) / 1_000_000.0
                            val resp = JSONObject().apply {
                                put("requestId", reqId.ifEmpty { "q_${System.currentTimeMillis()}" })
                                put("databaseId", dbId)
                                put("query", sql)
                                put("rows", JSONArray(rows.map { JSONObject(it) }))
                                put("affected", rows.size)
                                put("durationMs", elapsedMs)
                                put("success", true)
                            }
                            sendEnvelope("query_result", resp)
                        } catch (e: Exception) {
                            val elapsedMs = (System.nanoTime() - start) / 1_000_000.0
                            val errResp = JSONObject().apply {
                                put("requestId", reqId.ifEmpty { "q_${System.currentTimeMillis()}" })
                                put("databaseId", dbId)
                                put("query", sql)
                                put("rows", JSONArray())
                                put("affected", 0)
                                put("durationMs", elapsedMs)
                                put("success", false)
                                put("error", e.message ?: "Execution failed")
                            }
                            sendEnvelope("query_result", errResp)
                        }
                    }
                }
            }
        } catch (_: Exception) {}
    }
}
