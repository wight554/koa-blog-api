const passport = require('koa-passport');

const mongo = require('./mongo');
const { User } = mongo;

const { secret } = require("../config/keys");

const JwtStrategy = require("passport-jwt").Strategy;
  LocalStrategy = require('passport-local').Strategy
const ExtractJwt = require("passport-jwt").ExtractJwt;

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

passport.use(
  new LocalStrategy(
    {
      session: false
    },
    (username, password, done) => {
      User.findOne({ username }, (err, user) => {
        if (err) return done(err)
        if (!user || !user.comparePassword(password)) {
          return done('No such user or invalid password', false)
        }
        return done(null, user)
      })
    }
  )
)

passport.use(
  new JwtStrategy(
    {
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: secret
    },
    (token, done) => {
      try {
        return done(null, token)
      } catch (e) {
        done(e)
      }
    }
  )
)
