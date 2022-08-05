const { checkResourceIsFound } = require('../../helpers/http/restResponse');
const MessageService = require('./service');

async function create(req, res) {
  const { roomId, text } = req.body;
  const user = await req.getAuthUser();
  if (user.rooms.indexOf(roomId) === -1) { // TODO: move to validation
    checkResourceIsFound(null);
  }

  const message = await MessageService.create(roomId, user, text);

  res.status(201).json({
    data: message.id,
  });
}

async function findAllByRoomId(req, res) {
  const { roomId } = req.params;
  const limit = 1000;
  const user = await req.getAuthUser();
  if (user.rooms.indexOf(roomId) === -1) {
    checkResourceIsFound(null);
  }

  const messages = await MessageService.findAllByRoomId(roomId, limit);

  res.status(200).json({
    data: messages,
  });
}

module.exports = {
  create,
  findAllByRoomId,
};