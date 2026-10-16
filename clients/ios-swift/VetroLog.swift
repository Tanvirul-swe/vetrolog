import Foundation
import UIKit

/// VetroLog Mobile Database Inspector Client for iOS (Swift)
///
/// Uses Apple's native URLSessionWebSocketTask (zero external pods/frameworks needed)
/// to connect to the VetroLog Desktop app and stream SQLite / CoreData / UserDefaults.
public class VetroLog: NSObject, URLSessionWebSocketDelegate {
    public static let shared = VetroLog()

    private var webSocketTask: URLSessionWebSocketTask?
    private var session: URLSession?
    private var isConnected = false
    private var host: String = "localhost"
    private var port: Int = 9222
    private var appName: String = "iOS App"
    private var deviceId: String = "ios_\(UUID().uuidString.prefix(8))"

    private var databases: [[String: Any]] = []
    private var tableDataProviders: [String: (String, Int, Int) -> [[String: Any]]] = [:]
    private var queryExecutors: [String: (String) -> [[String: Any]]] = [:]
    private var userDefaultsObservers: [NSObjectProtocol] = []

    private override init() {
        super.init()
    }

    /// Initialize and connect to the desktop app
    public static func initialize(
        host: String = "localhost",
        port: Int = 9222,
        appName: String? = nil
    ) {
        let client = VetroLog.shared
        client.host = host
        client.port = port
        client.appName = appName ?? (Bundle.main.infoDictionary?["CFBundleName"] as? String ?? "iOS App")
        client.connect()
    }

    public func connect() {
        disconnect()

        guard let url = URL(string: "ws://\(host):\(port)/ws") else { return }
        session = URLSession(configuration: .default, delegate: self, delegateQueue: OperationQueue())
        webSocketTask = session?.webSocketTask(with: url)
        webSocketTask?.resume()

        listenForMessages()
    }

    public func disconnect() {
        webSocketTask?.cancel(with: .normalClosure, reason: nil)
        webSocketTask = nil
        isConnected = false
    }

    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didOpenWithProtocol protocol: String?) {
        isConnected = true
        sendHandshake()
        sendDatabaseList()
    }

    public func urlSession(_ session: URLSession, webSocketTask: URLSessionWebSocketTask, didCloseWith closeCode: URLSessionWebSocketTask.CloseCode, reason: Data?) {
        handleDisconnect()
    }

    private func handleDisconnect() {
        isConnected = false
        webSocketTask = nil
        DispatchQueue.global().asyncAfter(deadline: .now() + 3.0) { [weak self] in
            self?.connect()
        }
    }

    private func sendEnvelope(type: String, payload: Any) {
        guard isConnected, let task = webSocketTask else { return }

        let envelope: [String: Any] = [
            "type": type,
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "payload": payload
        ]

        guard let data = try? JSONSerialization.data(withJSONObject: envelope, options: []),
              let text = String(data: data, encoding: .utf8) else { return }

        task.send(.string(text)) { _ in }
    }

    private func sendHandshake() {
        let payload: [String: Any] = [
            "id": deviceId,
            "name": "\(UIDevice.current.name) (\(UIDevice.current.model))",
            "platform": "ios",
            "osVersion": "iOS \(UIDevice.current.systemVersion)",
            "appId": appName,
            "connectedAt": Int(Date().timeIntervalSince1970 * 1000)
        ]
        sendEnvelope(type: "handshake", payload: payload)
    }

    private func sendDatabaseList() {
        sendEnvelope(type: "db_list", payload: databases)
    }

    private func listenForMessages() {
        webSocketTask?.receive { [weak self] result in
            guard let self = self else { return }
            switch result {
            case .success(let message):
                switch message {
                case .string(let text):
                    self.handleIncomingMessage(text: text)
                case .data(let data):
                    if let text = String(data: data, encoding: .utf8) {
                        self.handleIncomingMessage(text: text)
                    }
                @unknown default:
                    break
                }
                self.listenForMessages()
            case .failure(_):
                self.handleDisconnect()
            }
        }
    }

    /// Register SQLite / CoreData database
    public func registerDatabase(
        id: String,
        name: String,
        type: String = "sqlite",
        path: String,
        tables: [[String: Any]],
        onFetchTableData: ((String, Int, Int) -> [[String: Any]])? = nil,
        onExecuteQuery: ((String) -> [[String: Any]])? = nil
    ) {
        databases.removeAll { ($0["id"] as? String) == id }
        let dbInfo: [String: Any] = [
            "id": id,
            "name": name,
            "type": type,
            "path": path,
            "sizeBytes": 0,
            "updatedAt": Int(Date().timeIntervalSince1970 * 1000),
            "tables": tables
        ]
        databases.append(dbInfo)

        if let provider = onFetchTableData { tableDataProviders[id] = provider }
        if let executor = onExecuteQuery { queryExecutors[id] = executor }

        sendDatabaseList()
    }

    /// Register UserDefaults inspector with automatic live change tracking
    public func registerUserDefaults(suiteName: String? = nil) {
        let defaults = suiteName != nil ? UserDefaults(suiteName: suiteName)! : UserDefaults.standard
        let id = suiteName ?? "standard_user_defaults"

        let tableSchema: [String: Any] = [
            "name": "defaults",
            "rowCount": defaults.dictionaryRepresentation().count,
            "columns": [
                ["name": "key", "type": "TEXT", "isPrimaryKey": true],
                ["name": "type", "type": "TEXT", "isPrimaryKey": false],
                ["name": "value", "type": "TEXT", "isPrimaryKey": false]
            ]
        ]

        registerDatabase(
            id: id,
            name: suiteName != nil ? "UserDefaults (\(suiteName!))" : "UserDefaults (Standard)",
            type: "shared_preferences",
            path: "Library/Preferences/\(suiteName ?? "standard").plist",
            tables: [tableSchema],
            onFetchTableData: { _, _, _ in
                let dict = defaults.dictionaryRepresentation()
                return dict.map { (key, val) in
                    [
                        "key": key,
                        "type": "\(type(of: val))",
                        "value": "\(val)"
                    ]
                }
            }
        )

        let obs = NotificationCenter.default.addObserver(
            forName: UserDefaults.didChangeNotification,
            object: defaults,
            queue: .main
        ) { [weak self] _ in
            self?.notifyMutation(
                databaseId: id,
                tableName: "defaults",
                type: "UPDATE"
            )
        }
        userDefaultsObservers.append(obs)
    }

    /// Report a live database mutation (INSERT, UPDATE, DELETE)
    public func notifyMutation(
        databaseId: String,
        tableName: String,
        type: String,
        query: String? = nil,
        durationMs: Double? = nil,
        oldValues: [String: Any]? = nil,
        newValues: [String: Any]? = nil,
        affected: Int = 1
    ) {
        var payload: [String: Any] = [
            "id": "mut_\(Int(Date().timeIntervalSince1970 * 1000))",
            "databaseId": databaseId,
            "tableName": tableName,
            "type": type.uppercased(),
            "timestamp": Int(Date().timeIntervalSince1970 * 1000),
            "affected": affected
        ]
        if let query = query { payload["query"] = query }
        if let durationMs = durationMs { payload["durationMs"] = durationMs }
        if let oldValues = oldValues { payload["oldValues"] = oldValues }
        if let newValues = newValues { payload["newValues"] = newValues }

        sendEnvelope(type: "mutation", payload: payload)
    }

    private func handleIncomingMessage(text: String) {
        guard let data = text.data(using: .utf8),
              let json = (try? JSONSerialization.jsonObject(with: data)) as? [String: Any],
              let action = json["action"] as? String,
              let payload = json["payload"] as? [String: Any] else { return }

        let reqId = json["requestId"] as? String

        switch action {
        case "fetch_table_data":
            guard let dbId = payload["databaseId"] as? String,
                  let tableName = payload["tableName"] as? String else { return }
            let page = payload["page"] as? Int ?? 1
            let pageSize = payload["pageSize"] as? Int ?? 50

            if let provider = tableDataProviders[dbId] {
                let rows = provider(tableName, page, pageSize)
                let resp: [String: Any] = [
                    "databaseId": dbId,
                    "tableName": tableName,
                    "totalRows": rows.count,
                    "page": page,
                    "pageSize": pageSize,
                    "columns": [],
                    "rows": rows
                ]
                sendEnvelope(type: "table_data", payload: resp)
            }

        case "execute_query":
            guard let dbId = payload["databaseId"] as? String,
                  let query = payload["query"] as? String,
                  let executor = queryExecutors[dbId] else { return }

            let start = Date()
            let rows = executor(query)
            let elapsed = Date().timeIntervalSince(start) * 1000.0

            let resp: [String: Any] = [
                "requestId": reqId ?? "q_\(Int(Date().timeIntervalSince1970 * 1000))",
                "databaseId": dbId,
                "query": query,
                "rows": rows,
                "affected": rows.count,
                "durationMs": elapsed,
                "success": true
            ]
            sendEnvelope(type: "query_result", payload: resp)

        default:
            break
        }
    }
}
