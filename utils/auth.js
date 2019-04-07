const passport = require('koa-passport'),
  LocalStrategy = require('passport-local').Strategy;

const mongo = require('./mongo');
const User = mongo.User;

passport.serializeUser(function(user, done) {
  done(null, user._id)
})

passport.deserializeUser(async function(id, done) {
  try {
    const user = await User.findOne({ _id: id })
    done(null, user)
  } catch(err) {
    done(err)
  }
})

passport.use(new LocalStrategy(function(username, password, done) {
  User.findOne({ username: username })
    .then(user => {
      if(!user)
        done(null, false)
      if (username === user.username && user.comparePassword(password)) {
        done(null, user)
      } else {
        done(null, false)
      }
    })
    .catch(err => done(err))
}))
