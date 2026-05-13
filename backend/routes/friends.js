const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

function toUserIdList(value) {
  if (!Array.isArray(value)) return null;
  const ids = value.map((v) => Number(v));
  if (ids.some((n) => !Number.isInteger(n) || n < 1)) return null;
  return ids;
}

async function areAlreadyFriends(userId, otherUserId) {
  const [rows] = await db.query(
    'SELECT id FROM friendships WHERE user_id = ? AND friend_user_id = ? LIMIT 1',
    [userId, otherUserId]
  );
  return rows.length > 0;
}

router.get('/', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         f.friend_user_id AS friendUserId,
         f.sort_order AS sortOrder,
         u.nickname,
         u.intro,
         u.avatar
       FROM friendships f
       INNER JOIN users u ON u.id = f.friend_user_id
       WHERE f.user_id = ?
       ORDER BY f.sort_order ASC, f.id ASC`,
      [req.userId]
    );
    return res.json({ friends: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'FRIENDS_FETCH_FAILED', message: '친구 목록 조회에 실패했습니다.' });
  }
});

router.patch('/order', requireAuth, async (req, res) => {
  const orderedIds = toUserIdList(req.body?.orderedUserIds);
  if (!orderedIds) {
    return res.status(400).json({ error: 'INVALID_BODY', message: 'orderedUserIds는 사용자 ID 문자열 배열이어야 합니다.' });
  }

  const [existingRows] = await db.query(
    'SELECT friend_user_id FROM friendships WHERE user_id = ?',
    [req.userId]
  );
  const existingIds = existingRows.map((r) => Number(r.friend_user_id));
  if (existingIds.length !== orderedIds.length) {
    return res.status(400).json({ error: 'INVALID_ORDER_COUNT', message: '친구 수와 orderedUserIds 길이가 다릅니다.' });
  }
  const existingSet = new Set(existingIds);
  if (orderedIds.some((id) => !existingSet.has(id)) || new Set(orderedIds).size !== orderedIds.length) {
    return res.status(400).json({ error: 'INVALID_ORDER_IDS', message: 'orderedUserIds에 잘못된 ID가 포함되어 있습니다.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < orderedIds.length; i += 1) {
      await conn.query(
        'UPDATE friendships SET sort_order = ? WHERE user_id = ? AND friend_user_id = ?',
        [i, req.userId, orderedIds[i]]
      );
    }
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ error: 'FRIEND_ORDER_UPDATE_FAILED', message: '친구 순서 저장에 실패했습니다.' });
  } finally {
    conn.release();
  }
});

router.delete('/:friendUserId', requireAuth, async (req, res) => {
  const friendUserId = Number(req.params.friendUserId);
  if (!Number.isInteger(friendUserId) || friendUserId < 1) {
    return res.status(400).json({ error: 'INVALID_FRIEND_USER_ID', message: '유효한 친구 사용자 ID가 필요합니다.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [existing] = await conn.query(
      `SELECT 1 AS ok FROM friendships
       WHERE (user_id = ? AND friend_user_id = ?) OR (user_id = ? AND friend_user_id = ?)
       LIMIT 1`,
      [req.userId, friendUserId, friendUserId, req.userId]
    );
    if (!existing.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'FRIEND_NOT_FOUND', message: '친구 관계를 찾을 수 없습니다.' });
    }

    await conn.query('DELETE FROM friendships WHERE user_id = ? AND friend_user_id = ?', [req.userId, friendUserId]);
    await conn.query('DELETE FROM friendships WHERE user_id = ? AND friend_user_id = ?', [friendUserId, req.userId]);
    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ error: 'FRIEND_DELETE_FAILED', message: '친구 삭제에 실패했습니다.' });
  } finally {
    conn.release();
  }
});

router.post('/requests', requireAuth, async (req, res) => {
  const rawFriendCode =
    typeof req.body?.friendCode === 'string'
      ? req.body.friendCode
      : typeof req.body?.friend_code === 'string'
        ? req.body.friend_code
        : '';
  const friendCode = rawFriendCode.trim().toUpperCase();
  if (!friendCode) {
    return res.status(400).json({ error: 'INVALID_FRIEND_CODE', message: 'friendCode를 입력해 주세요.' });
  }

  try {
    const [targetRows] = await db.query(
      'SELECT id FROM users WHERE friend_code = ? LIMIT 1',
      [friendCode]
    );
    if (!targetRows.length) {
      return res.status(404).json({ error: 'FRIEND_CODE_NOT_FOUND', message: '유효하지 않은 친구 코드입니다.' });
    }
    const targetUserId = Number(targetRows[0].id);
    if (targetUserId === req.userId) {
      return res.status(400).json({ error: 'CANNOT_REQUEST_SELF', message: '자기 자신에게 친구 요청할 수 없습니다.' });
    }

    if (await areAlreadyFriends(req.userId, targetUserId)) {
      return res.status(409).json({ error: 'ALREADY_FRIENDS', message: '이미 친구입니다.' });
    }

    const [duplicateRows] = await db.query(
      `SELECT id FROM friend_requests
       WHERE status = 'pending'
         AND ((from_user_id = ? AND to_user_id = ?) OR (from_user_id = ? AND to_user_id = ?))
       LIMIT 1`,
      [req.userId, targetUserId, targetUserId, req.userId]
    );
    if (duplicateRows.length) {
      return res.status(409).json({ error: 'FRIEND_REQUEST_ALREADY_PENDING', message: '이미 대기 중인 친구 요청이 있습니다.' });
    }

    const [result] = await db.query(
      'INSERT INTO friend_requests (from_user_id, to_user_id, status) VALUES (?, ?, ?)',
      [req.userId, targetUserId, 'pending']
    );
    return res.status(201).json({ ok: true, requestId: result.insertId });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'FRIEND_REQUEST_CREATE_FAILED', message: '친구 요청 생성에 실패했습니다.' });
  }
});

router.get('/requests/incoming', requireAuth, async (req, res) => {
  try {
    const [rows] = await db.query(
      `SELECT
         r.id,
         r.from_user_id AS fromUserId,
         r.created_at AS createdAt,
         u.nickname,
         u.intro,
         u.avatar
       FROM friend_requests r
       INNER JOIN users u ON u.id = r.from_user_id
       WHERE r.to_user_id = ? AND r.status = 'pending'
       ORDER BY r.created_at DESC`,
      [req.userId]
    );
    return res.json({ requests: rows });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'INCOMING_REQUESTS_FETCH_FAILED', message: '받은 친구 요청 조회에 실패했습니다.' });
  }
});

router.post('/requests/:requestId/accept', requireAuth, async (req, res) => {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({ error: 'INVALID_REQUEST_ID', message: '유효한 요청 ID가 필요합니다.' });
  }

  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const [rows] = await conn.query(
      `SELECT id, from_user_id, to_user_id, status
       FROM friend_requests
       WHERE id = ? AND to_user_id = ?
       LIMIT 1`,
      [requestId, req.userId]
    );
    if (!rows.length) {
      await conn.rollback();
      return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: '친구 요청을 찾을 수 없습니다.' });
    }
    const row = rows[0];
    if (row.status !== 'pending') {
      await conn.rollback();
      return res.status(409).json({ error: 'REQUEST_ALREADY_PROCESSED', message: '이미 처리된 요청입니다.' });
    }

    const fromUserId = Number(row.from_user_id);
    const toUserId = Number(row.to_user_id);
    await conn.query('UPDATE friend_requests SET status = ? WHERE id = ?', ['accepted', requestId]);
    await conn.query(
      'INSERT INTO friendships (user_id, friend_user_id, sort_order) VALUES (?, ?, 0) ON CONFLICT(user_id, friend_user_id) DO NOTHING',
      [fromUserId, toUserId]
    );
    await conn.query(
      'INSERT INTO friendships (user_id, friend_user_id, sort_order) VALUES (?, ?, 0) ON CONFLICT(user_id, friend_user_id) DO NOTHING',
      [toUserId, fromUserId]
    );

    await conn.commit();
    return res.json({ ok: true });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ error: 'REQUEST_ACCEPT_FAILED', message: '친구 요청 수락에 실패했습니다.' });
  } finally {
    conn.release();
  }
});

router.post('/requests/:requestId/reject', requireAuth, async (req, res) => {
  const requestId = Number(req.params.requestId);
  if (!Number.isInteger(requestId) || requestId < 1) {
    return res.status(400).json({ error: 'INVALID_REQUEST_ID', message: '유효한 요청 ID가 필요합니다.' });
  }

  try {
    const [rows] = await db.query(
      `SELECT id, status
       FROM friend_requests
       WHERE id = ? AND to_user_id = ?
       LIMIT 1`,
      [requestId, req.userId]
    );
    if (!rows.length) {
      return res.status(404).json({ error: 'REQUEST_NOT_FOUND', message: '친구 요청을 찾을 수 없습니다.' });
    }
    if (rows[0].status !== 'pending') {
      return res.status(409).json({ error: 'REQUEST_ALREADY_PROCESSED', message: '이미 처리된 요청입니다.' });
    }
    await db.query('UPDATE friend_requests SET status = ? WHERE id = ?', ['rejected', requestId]);
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'REQUEST_REJECT_FAILED', message: '친구 요청 거절에 실패했습니다.' });
  }
});

module.exports = router;
