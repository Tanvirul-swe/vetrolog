import 'dart:convert';

/// Wire protocol constants matching the Go backend
class VetroLogProtocol {
  static const String typeHandshake = 'handshake';
  static const String typeDbList = 'db_list';
  static const String typeTableData = 'table_data';
  static const String typeMutation = 'mutation';
  static const String typeQueryResult = 'query_result';

  static const String actionFetchTableData = 'fetch_table_data';
  static const String actionExecuteQuery = 'execute_query';
  static const String actionUpdateRow = 'update_row';
  static const String actionDeleteRow = 'delete_row';

  static String encodeEnvelope(String type, dynamic payload) {
    return jsonEncode({
      'type': type,
      'timestamp': DateTime.now().millisecondsSinceEpoch,
      'payload': payload,
    });
  }
}
