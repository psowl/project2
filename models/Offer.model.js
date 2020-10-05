const { Date } = require('mongoose');
const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const offerSchema = Schema({
  creatorId: {type: Schema.Types.ObjectId, ref: 'User'},
  authorId: {type: Schema.Types.ObjectId, ref: 'User'},
  postId: {type: Schema.Types.ObjectId, ref: 'Post'},
  goodToExchange: {type: Schema.Types.ObjectId, ref: 'Post'},
  //pointsEstimate: String,
  messages: String,
  status: {
    type: String,
    enum: ['Pending', 'Accepted', 'Refused'],
    default: 'Pending'
  }
},
{
  timestamps: true,
}
);


offerSchema.virtual('alreadyanswered').get(function() {
  if (this.status !== 'Pending') {
    return true;
  } else {
    return false;
  }
});
const Offer = mongoose.model('Offer', offerSchema);


module.exports = Offer;
