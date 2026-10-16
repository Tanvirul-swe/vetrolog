import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:web_socket_channel/web_socket_channel.dart';
import 'src/vetrolog_protocol.dart';

/// Main client for connecting a Flutter mobile application to VetroLog desktop
class VetroLog {
  static VetroLog? _instance;
  static VetroLog get instance => _instance ??= VetroLog._();

  WebSocketChannel? _channel;
  Timer? _reconnectTimer;
  bool _isConnected = false;

  String _host = 'localhost';
  int _port = 9222;
  String _appName = 'Flutter App';
  String _deviceId = 'device_${DateTime.now().millisecondsSinceEpoch}';

  // Registered databases and query handlers
  final List<Map<String, dynamic>> _databases = [];
  final Map<String, Future<dynamic> Function(String query)> _queryExecutors = {};
  final Map<String, Future<List<Map<String, dynamic>>> Function(String table, int page, int size)> _tableDataProviders = {};
  final Map<String, Future<bool> Function(String table, Map<String, dynamic> pk, Map<String, dynamic> values)> _updateHandlers = {};
  final Map<String, Future<bool> Function(String table, Map<String, dynamic> pk)> _deleteHandlers = {};

  VetroLog._();

  /// Initialize and connect to the desktop application
  static void init({
    String host = 'localhost',
    int port = 9222,
    String? appName,
    String? deviceId,
  }) {
    final client = VetroLog.instance;
    client._host = host;
    client._port = port;
    if (appName != null) client._appName = appName;
    if (deviceId != null) client._deviceId = deviceId;

    client._connect();
  }

  /// Connect using scanned QR code data (deep link vetrolog://, raw JSON, or ws:// URL)
  static void connectFromQr(String scannedData) {
    final client = VetroLog.instance;
    try {
      final trimmed = scannedData.trim();
      if (trimmed.startsWith('vetrolog://')) {
        final uri = Uri.parse(trimmed);
        final urlParam = uri.queryParameters['url'];
        if (urlParam != null) {
          client.connectToUrl(urlParam);
          return;
        }
        final hostParam = uri.queryParameters['host'];
        final portParam = int.tryParse(uri.queryParameters['port'] ?? '9222') ?? 9222;
        if (hostParam != null) {
          init(host: hostParam, port: portParam);
          return;
        }
      } else if (trimmed.startsWith('{')) {
        final map = jsonDecode(trimmed) as Map<String, dynamic>;
        if (map['wsUrl'] != null) {
          client.connectToUrl(map['wsUrl'] as String);
          return;
        }
        if (map['host'] != null) {
          init(host: map['host'] as String, port: map['port'] as int? ?? 9222);
          return;
        }
      } else if (trimmed.startsWith('ws://') || trimmed.startsWith('wss://')) {
        client.connectToUrl(trimmed);
        return;
      }
    } catch (e) {
      debugPrint('[VetroLog] Failed to parse QR code data: $e');
    }
  }

  /// Connect directly to a WebSocket URL
  void connectToUrl(String url) {
    try {
      final uri = Uri.parse(url);
      _host = uri.host;
      _port = uri.port != 0 ? uri.port : 9222;
      _connect();
    } catch (e) {
      debugPrint('[VetroLog] Invalid URL $url: $e');
    }
  }

  void _connect() {
    _reconnectTimer?.cancel();
    final uri = Uri.parse('ws://$_host:$_port/ws');

    try {
      _channel = WebSocketChannel.connect(uri);
      _channel!.stream.listen(
        _onMessage,
        onDone: _onDisconnect,
        onError: (err) => _onDisconnect(),
      );

      _isConnected = true;
      _sendHandshake();
      _sendDatabaseList();
    } catch (_) {
      _onDisconnect();
    }
  }

  void _onDisconnect() {
    _isConnected = false;
    _channel = null;
    _reconnectTimer?.cancel();
    _reconnectTimer = Timer(const Duration(seconds: 3), _connect);
  }

  void _sendHandshake() {
    if (!_isConnected || _channel == null) return;

    final payload = {
      'id': _deviceId,
      'name': '${Platform.operatingSystem} (${_appName})',
      'platform': Platform.operatingSystem,
      'osVersion': Platform.operatingSystemVersion,
      'appId': _appName,
      'connectedAt': DateTime.now().millisecondsSinceEpoch,
    };

    _channel!.sink.add(VetroLogProtocol.encodeEnvelope(VetroLogProtocol.typeHandshake, payload));
  }

  void _sendDatabaseList() {
    if (!_isConnected || _channel == null) return;
    _channel!.sink.add(VetroLogProtocol.encodeEnvelope(VetroLogProtocol.typeDbList, _databases));
  }

  void _onMessage(dynamic raw) {
    try {
      final envelope = jsonDecode(raw as String);
      final action = envelope['action'] as String?;
      final reqId = envelope['requestId'] as String?;
      final payload = envelope['payload'] as Map<String, dynamic>?;

      if (action == null || payload == null) return;

      switch (action) {
        case VetroLogProtocol.actionFetchTableData:
          _handleFetchTableData(reqId, payload);
          break;
        case VetroLogProtocol.actionExecuteQuery:
          _handleExecuteQuery(reqId, payload);
          break;
        case VetroLogProtocol.actionUpdateRow:
          _handleUpdateRow(reqId, payload);
          break;
        case VetroLogProtocol.actionDeleteRow:
          _handleDeleteRow(reqId, payload);
          break;
      }
    } catch (e) {
      debugPrint('[VetroLog Client] Error processing message: $e');
    }
  }

  /// Register a database with schema and handler callbacks
  void registerDatabase({
    required String id,
    required String name,
    required String type, // 'sqlite', 'hive', 'shared_preferences'
    required String path,
    required List<Map<String, dynamic>> tables,
    Future<List<Map<String, dynamic>>> Function(String table, int page, int size)? onFetchTableData,
    Future<dynamic> Function(String query)? onExecuteQuery,
    Future<bool> Function(String table, Map<String, dynamic> pk, Map<String, dynamic> values)? onUpdateRow,
    Future<bool> Function(String table, Map<String, dynamic> pk)? onDeleteRow,
  }) {
    _databases.removeWhere((d) => d['id'] == id);
    _databases.add({
      'id': id,
      'name': name,
      'type': type,
      'path': path,
      'tables': tables,
      'sizeBytes': 0,
      'updatedAt': DateTime.now().millisecondsSinceEpoch,
    });

    if (onFetchTableData != null) _tableDataProviders[id] = onFetchTableData;
    if (onExecuteQuery != null) _queryExecutors[id] = onExecuteQuery;
    if (onUpdateRow != null) _updateHandlers[id] = onUpdateRow;
    if (onDeleteRow != null) _deleteHandlers[id] = onDeleteRow;

    _sendDatabaseList();
  }

  /// Emit a live mutation event (e.g. after sqflite insert or hive put)
  void notifyMutation({
    required String databaseId,
    required String tableName,
    required String type, // 'INSERT', 'UPDATE', 'DELETE'
    String? query,
    double? durationMs,
    Map<String, dynamic>? oldValues,
    Map<String, dynamic>? newValues,
    int affected = 1,
  }) {
    if (!_isConnected || _channel == null) return;

    final payload = {
      'id': 'mut_${DateTime.now().millisecondsSinceEpoch}',
      'databaseId': databaseId,
      'tableName': tableName,
      'type': type,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'query': query,
      'durationMs': durationMs,
      'oldValues': oldValues,
      'newValues': newValues,
      'affected': affected,
    };

    _channel!.sink.add(VetroLogProtocol.encodeEnvelope(VetroLogProtocol.typeMutation, payload));
  }

  Future<void> _handleFetchTableData(String? reqId, Map<String, dynamic> payload) async {
    final dbId = payload['databaseId'] as String?;
    final tableName = payload['tableName'] as String?;
    final page = payload['page'] as int? ?? 1;
    final size = payload['pageSize'] as int? ?? 50;

    if (dbId == null || tableName == null) return;

    final provider = _tableDataProviders[dbId];
    if (provider != null) {
      final rows = await provider(tableName, page, size);
      final resp = {
        'databaseId': dbId,
        'tableName': tableName,
        'totalRows': rows.length,
        'page': page,
        'pageSize': size,
        'columns': [],
        'rows': rows,
      };
      _channel?.sink.add(VetroLogProtocol.encodeEnvelope(VetroLogProtocol.typeTableData, resp));
    }
  }

  Future<void> _handleExecuteQuery(String? reqId, Map<String, dynamic> payload) async {
    final dbId = payload['databaseId'] as String?;
    final query = payload['query'] as String?;

    if (dbId == null || query == null) return;

    final executor = _queryExecutors[dbId];
    final sw = Stopwatch()..start();

    if (executor != null) {
      try {
        final result = await executor(query);
        sw.stop();

        final resultPayload = {
          'requestId': reqId ?? 'q_${DateTime.now().millisecondsSinceEpoch}',
          'databaseId': dbId,
          'query': query,
          'rows': result is List ? result : [],
          'affected': result is int ? result : 0,
          'durationMs': sw.elapsedMicroseconds / 1000.0,
          'success': true,
        };

        _channel?.sink.add(VetroLogProtocol.encodeEnvelope(VetroLogProtocol.typeQueryResult, resultPayload));
      } catch (e) {
        sw.stop();
        final errPayload = {
          'requestId': reqId ?? 'q_${DateTime.now().millisecondsSinceEpoch}',
          'databaseId': dbId,
          'query': query,
          'rows': [],
          'affected': 0,
          'durationMs': sw.elapsedMicroseconds / 1000.0,
          'success': false,
          'error': e.toString(),
        };
        _channel?.sink.add(VetroLogProtocol.encodeEnvelope(VetroLogProtocol.typeQueryResult, errPayload));
      }
    }
  }

  Future<void> _handleUpdateRow(String? reqId, Map<String, dynamic> payload) async {
    final dbId = payload['databaseId'] as String?;
    final tableName = payload['tableName'] as String?;
    final pk = payload['primaryKey'] as Map<String, dynamic>?;
    final newValues = payload['newValues'] as Map<String, dynamic>?;

    if (dbId == null || tableName == null || pk == null || newValues == null) return;

    final handler = _updateHandlers[dbId];
    if (handler != null) {
      final success = await handler(tableName, pk, newValues);
      if (success) {
        notifyMutation(
          databaseId: dbId,
          tableName: tableName,
          type: 'UPDATE',
          newValues: newValues,
        );
      }
    }
  }

  Future<void> _handleDeleteRow(String? reqId, Map<String, dynamic> payload) async {
    final dbId = payload['databaseId'] as String?;
    final tableName = payload['tableName'] as String?;
    final pk = payload['primaryKey'] as Map<String, dynamic>?;

    if (dbId == null || tableName == null || pk == null) return;

    final handler = _deleteHandlers[dbId];
    if (handler != null) {
      final success = await handler(tableName, pk);
      if (success) {
        notifyMutation(
          databaseId: dbId,
          tableName: tableName,
          type: 'DELETE',
          oldValues: pk,
        );
      }
    }
  }
}
