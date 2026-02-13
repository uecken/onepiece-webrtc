/**
 * One Piece Card Battle - Google Apps Script Backend
 *
 * このスクリプトをGoogle SpreadsheetのApps Scriptにコピーして使用します。
 * WebアプリとしてデプロイすることでAPIエンドポイントとして機能します。
 */

// シート名の定数
const SHEET_ISLANDS = 'Islands';
const SHEET_BATTLES = 'Battles';
const SHEET_SIGNALING = 'Signaling';
const SHEET_ICE = 'IceCandidates';

/**
 * CORSヘッダー付きでJSONレスポンスを返す
 */
function createJsonResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GETリクエストのハンドラ
 */
function doGet(e) {
  const action = e.parameter.action;

  try {
    switch (action) {
      case 'getIslands':
        return createJsonResponse(getIslands());

      case 'getIsland':
        return createJsonResponse(getIsland(e.parameter.islandId));

      case 'getSignaling':
        return createJsonResponse(getSignaling(e.parameter.battleId));

      case 'getIceCandidates':
        return createJsonResponse(getIceCandidates(
          e.parameter.battleId,
          e.parameter.excludeUserId
        ));

      case 'getBattle':
        return createJsonResponse(getBattle(e.parameter.battleId));

      default:
        return createJsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return createJsonResponse({ error: error.message });
  }
}

/**
 * POSTリクエストのハンドラ
 */
function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action;

  try {
    switch (action) {
      case 'enterIsland':
        return createJsonResponse(enterIsland(data.islandId, data.userId));

      case 'leaveIsland':
        return createJsonResponse(leaveIsland(data.islandId, data.userId));

      case 'createBattle':
        return createJsonResponse(createBattle(
          data.islandId,
          data.creatorId,
          data.joinerId
        ));

      case 'writeOffer':
        return createJsonResponse(writeSignaling(
          data.battleId,
          'offer',
          data.sdp,
          data.userId
        ));

      case 'writeAnswer':
        return createJsonResponse(writeSignaling(
          data.battleId,
          'answer',
          data.sdp,
          data.userId
        ));

      case 'writeIceCandidate':
        return createJsonResponse(writeIceCandidate(
          data.battleId,
          data.candidate,
          data.sdpMid,
          data.sdpMLineIndex,
          data.userId
        ));

      case 'endBattle':
        return createJsonResponse(endBattle(data.battleId, data.islandId));

      case 'updateBattleStatus':
        return createJsonResponse(updateBattleStatus(data.battleId, data.status));

      default:
        return createJsonResponse({ error: 'Unknown action' });
    }
  } catch (error) {
    return createJsonResponse({ error: error.message });
  }
}

/**
 * 全島を取得
 */
function getIslands() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ISLANDS);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const islands = [];

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    if (row[0]) {  // islandIdが存在する場合
      islands.push({
        id: row[0],
        name: row[1],
        status: row[2] || 'empty',
        waitingUser: row[3] || null,
        users: row[4] ? row[4].split(',') : [],
        currentBattleId: row[5] || null,
        updatedAt: row[6] || null
      });
    }
  }

  return { islands: islands };
}

/**
 * 特定の島を取得
 */
function getIsland(islandId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ISLANDS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === islandId) {
      return {
        island: {
          id: data[i][0],
          name: data[i][1],
          status: data[i][2] || 'empty',
          waitingUser: data[i][3] || null,
          users: data[i][4] ? data[i][4].split(',') : [],
          currentBattleId: data[i][5] || null,
          updatedAt: data[i][6] || null
        }
      };
    }
  }

  return { island: null };
}

/**
 * 島に入室（待機開始）
 */
function enterIsland(islandId, userId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ISLANDS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === islandId) {
      const row = i + 1;
      sheet.getRange(row, 3).setValue('waiting');  // status
      sheet.getRange(row, 4).setValue(userId);     // waitingUser
      sheet.getRange(row, 5).setValue(userId);     // users
      sheet.getRange(row, 7).setValue(new Date().toISOString());  // updatedAt

      return { success: true };
    }
  }

  return { success: false, error: 'Island not found' };
}

/**
 * 島から退出
 */
function leaveIsland(islandId, userId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ISLANDS);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === islandId && data[i][3] === userId) {
      const row = i + 1;
      sheet.getRange(row, 3).setValue('empty');    // status
      sheet.getRange(row, 4).setValue('');         // waitingUser
      sheet.getRange(row, 5).setValue('');         // users
      sheet.getRange(row, 6).setValue('');         // currentBattleId
      sheet.getRange(row, 7).setValue(new Date().toISOString());  // updatedAt

      return { success: true };
    }
  }

  return { success: false, error: 'Island or user not found' };
}

/**
 * バトルを作成
 */
function createBattle(islandId, creatorId, joinerId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const islandsSheet = ss.getSheetByName(SHEET_ISLANDS);
  const battlesSheet = ss.getSheetByName(SHEET_BATTLES);
  const data = islandsSheet.getDataRange().getValues();

  const battleId = 'battle_' + Utilities.getUuid().substring(0, 8);
  const now = new Date().toISOString();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === islandId) {
      const row = i + 1;
      islandsSheet.getRange(row, 3).setValue('in_battle');  // status
      islandsSheet.getRange(row, 5).setValue(creatorId + ',' + joinerId);  // users
      islandsSheet.getRange(row, 6).setValue(battleId);     // currentBattleId
      islandsSheet.getRange(row, 7).setValue(now);  // updatedAt

      // Battlesシートにも記録
      if (battlesSheet) {
        battlesSheet.appendRow([
          battleId,
          islandId,
          creatorId,
          joinerId,
          'connecting',  // status
          now,           // createdAt
          ''             // endedAt
        ]);
      }

      return { success: true, battleId: battleId };
    }
  }

  return { success: false, error: 'Island not found' };
}

/**
 * バトル情報を取得
 */
function getBattle(battleId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BATTLES);
  if (!sheet) {
    return { battle: null, error: 'Battles sheet not found' };
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === battleId) {
      return {
        battle: {
          id: data[i][0],
          islandId: data[i][1],
          creatorId: data[i][2],
          joinerId: data[i][3],
          status: data[i][4] || 'connecting',
          createdAt: data[i][5] || null,
          endedAt: data[i][6] || null
        }
      };
    }
  }

  return { battle: null };
}

/**
 * バトル状態を更新
 */
function updateBattleStatus(battleId, status) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_BATTLES);
  if (!sheet) {
    return { success: false, error: 'Battles sheet not found' };
  }

  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === battleId) {
      const row = i + 1;
      sheet.getRange(row, 5).setValue(status);  // status column
      if (status === 'ended') {
        sheet.getRange(row, 7).setValue(new Date().toISOString());  // endedAt
      }
      return { success: true };
    }
  }

  return { success: false, error: 'Battle not found' };
}

/**
 * シグナリングデータを取得
 */
function getSignaling(battleId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_SIGNALING);
  if (!sheet) {
    return { offer: null, answer: null, error: 'Signaling sheet not found. Please run setupInitialData() first.' };
  }
  const data = sheet.getDataRange().getValues();

  let offer = null;
  let answer = null;

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === battleId) {
      const type = data[i][1];
      const signaling = {
        sdp: data[i][2],
        type: type,
        fromUserId: data[i][3],
        createdAt: data[i][4]
      };

      if (type === 'offer') {
        offer = signaling;
      } else if (type === 'answer') {
        answer = signaling;
      }
    }
  }

  return { offer: offer, answer: answer };
}

/**
 * シグナリングデータを書き込み
 */
function writeSignaling(battleId, type, sdp, userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_SIGNALING);

  // シートが存在しない場合は自動作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_SIGNALING);
    sheet.appendRow(['battleId', 'type', 'sdp', 'fromUserId', 'createdAt']);
  }

  // 既存のエントリを更新または新規追加
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === battleId && data[i][1] === type) {
      // 既存エントリを更新
      const row = i + 1;
      sheet.getRange(row, 3).setValue(sdp);
      sheet.getRange(row, 4).setValue(userId);
      sheet.getRange(row, 5).setValue(new Date().toISOString());
      return { success: true };
    }
  }

  // 新規追加
  sheet.appendRow([
    battleId,
    type,
    sdp,
    userId,
    new Date().toISOString()
  ]);

  return { success: true };
}

/**
 * ICE候補を取得
 */
function getIceCandidates(battleId, excludeUserId) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_ICE);
  if (!sheet) {
    return { candidates: [], error: 'IceCandidates sheet not found. Please run setupInitialData() first.' };
  }
  const data = sheet.getDataRange().getValues();

  const candidates = [];

  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === battleId && data[i][4] !== excludeUserId) {
      candidates.push({
        candidate: data[i][1],
        sdpMid: data[i][2],
        sdpMLineIndex: data[i][3],
        fromUserId: data[i][4],
        createdAt: data[i][5]
      });
    }
  }

  return { candidates: candidates };
}

/**
 * ICE候補を書き込み
 */
function writeIceCandidate(battleId, candidate, sdpMid, sdpMLineIndex, userId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_ICE);

  // シートが存在しない場合は自動作成
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_ICE);
    sheet.appendRow(['battleId', 'candidate', 'sdpMid', 'sdpMLineIndex', 'fromUserId', 'createdAt']);
  }

  sheet.appendRow([
    battleId,
    candidate,
    sdpMid,
    sdpMLineIndex,
    userId,
    new Date().toISOString()
  ]);

  return { success: true };
}

/**
 * バトルを終了
 */
function endBattle(battleId, islandId) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const islandsSheet = ss.getSheetByName(SHEET_ISLANDS);
  const battlesSheet = ss.getSheetByName(SHEET_BATTLES);
  const islandsData = islandsSheet.getDataRange().getValues();
  const now = new Date().toISOString();

  // Islandsシートを更新
  for (let i = 1; i < islandsData.length; i++) {
    if (islandsData[i][0] === islandId) {
      const row = i + 1;
      islandsSheet.getRange(row, 3).setValue('empty');    // status
      islandsSheet.getRange(row, 4).setValue('');         // waitingUser
      islandsSheet.getRange(row, 5).setValue('');         // users
      islandsSheet.getRange(row, 6).setValue('');         // currentBattleId
      islandsSheet.getRange(row, 7).setValue(now);  // updatedAt
      break;
    }
  }

  // Battlesシートも更新
  if (battlesSheet && battleId) {
    const battlesData = battlesSheet.getDataRange().getValues();
    for (let i = 1; i < battlesData.length; i++) {
      if (battlesData[i][0] === battleId) {
        const row = i + 1;
        battlesSheet.getRange(row, 5).setValue('ended');  // status
        battlesSheet.getRange(row, 7).setValue(now);      // endedAt
        break;
      }
    }
  }

  return { success: true };
}

/**
 * 初期データをセットアップ（必要に応じて手動で実行）
 */
function setupInitialData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // Islandsシートの作成
  let islandsSheet = ss.getSheetByName(SHEET_ISLANDS);
  if (!islandsSheet) {
    islandsSheet = ss.insertSheet(SHEET_ISLANDS);
    islandsSheet.appendRow(['islandId', 'name', 'status', 'waitingUser', 'users', 'currentBattleId', 'updatedAt']);
    islandsSheet.appendRow(['east-blue', 'East Blue Island', 'empty', '', '', '', '']);
    islandsSheet.appendRow(['grand-line', 'Grand Line Island', 'empty', '', '', '', '']);
    islandsSheet.appendRow(['new-world', 'New World Island', 'empty', '', '', '', '']);
    islandsSheet.appendRow(['wano', 'Wano Country', 'empty', '', '', '', '']);
    islandsSheet.appendRow(['skypiea', 'Skypiea Island', 'empty', '', '', '', '']);
  }

  // Battlesシートの作成
  let battlesSheet = ss.getSheetByName(SHEET_BATTLES);
  if (!battlesSheet) {
    battlesSheet = ss.insertSheet(SHEET_BATTLES);
    battlesSheet.appendRow(['battleId', 'islandId', 'creatorId', 'joinerId', 'status', 'createdAt', 'endedAt']);
  }

  // Signalingシートの作成
  let signalingSheet = ss.getSheetByName(SHEET_SIGNALING);
  if (!signalingSheet) {
    signalingSheet = ss.insertSheet(SHEET_SIGNALING);
    signalingSheet.appendRow(['battleId', 'type', 'sdp', 'fromUserId', 'createdAt']);
  }

  // IceCandidatesシートの作成
  let iceSheet = ss.getSheetByName(SHEET_ICE);
  if (!iceSheet) {
    iceSheet = ss.insertSheet(SHEET_ICE);
    iceSheet.appendRow(['battleId', 'candidate', 'sdpMid', 'sdpMLineIndex', 'fromUserId', 'createdAt']);
  }

  return 'Setup complete!';
}
