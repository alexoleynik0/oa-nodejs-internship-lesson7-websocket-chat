const { Schema } = require('mongoose');
const mongooseConnection = require('../../../config/mongooseConnection');
const modifyMongooseSchema = require('../../../helpers/db/modifyMongooseSchema');

const COLLECTION_NAME = 'users';
const MODEL_NAME = 'UserModel';

const schema = new Schema(
  {
    nickname: {
      type: String,
      trim: true,
      required: true,
      unique: true,
    },
    fullName: {
      type: String,
      trim: true,
    },
    photoUrl: {
      type: String,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },

    lastActivityAt: {
      type: Date,
    },

    // relations
    rooms: [{ type: Schema.Types.ObjectId, ref: 'RoomModel' }],
  },
  {
    collection: COLLECTION_NAME,
    timestamps: true,
    versionKey: false,
  },
);

schema.index(
  { nickname: 'text', fullName: 'text' },
  { name: 'nickname_text_fullName_text', weights: { nickname: 10, fullName: 5 } },
);

const ONLINE_STILL_AFTER_MILLISECONDS = 120 * 1000; // 2m IDEA: move to env ?
schema.virtual('online').get(function () {
  if (this.lastActivityAt === undefined) {
    return false;
  }
  return Date.now() - this.lastActivityAt.getTime() < ONLINE_STILL_AFTER_MILLISECONDS;
});

modifyMongooseSchema(schema);

module.exports = mongooseConnection.model(MODEL_NAME, schema);
