const mongoose = require('mongoose'),
  uniqueValidator = require('mongoose-unique-validator'),
  { Schema } = mongoose,
  { ObjectId } = mongoose.Types,
  { mongoUrl } = require('../config/keys');

const bcrypt = require('bcrypt'),
  saltRounds = 10;

const postSchema = new Schema(
  {
    name: String,
    title: String,
    date: { type: Date, default: Date.now },
    author: { type: Schema.Types.ObjectId, ref: 'User' },
    comments: [
      {
        name: String,
        date: { type: Date, default: Date.now },
        author: { type: Schema.Types.ObjectId, ref: 'User' },
      },
    ],
  },
  { versionKey: false }
);

const userSchema = new Schema(
  {
    username: { type: String, required: true, unique: true },
    firstName: { type: String },
    lastName: { type: String },
    password: { type: String, required: true, select: false },
  },
  { versionKey: false }
);

userSchema.pre('save', function (next) {
  this.password = bcrypt.hashSync(this.password, saltRounds);
  next();
});

userSchema.pre('updateOne', function (next) {
  if (this.password) {
    this.password = bcrypt.hashSync(this.password, saltRounds);
  }
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compareSync(candidatePassword, this.password);
};

userSchema.plugin(uniqueValidator);

const Post = mongoose.model('Post', postSchema);
const User = mongoose.model('User', userSchema);

mongoose.connect(mongoUrl, { useNewUrlParser: true, useCreateIndex: true, useUnifiedTopology: true });

module.exports.Post = Post;
module.exports.User = User;
module.exports.ObjectId = ObjectId;
