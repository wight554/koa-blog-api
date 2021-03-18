const jwt = require('koa-jwt');
const { secret } = require('../config/keys');
const jwtInstance = jwt({ secret: secret });
const jsonwebtoken = require('jsonwebtoken');

const JWTErrorHandler = (ctx, next) => {
  return next().catch((err) => {
    if (401 == err.status) {
      ctx.status = 401;
      ctx.body = {
        message: 'Not authorized',
      };
    } else {
      throw err;
    }
  });
};

module.exports.jwt = () => jwtInstance;
module.exports.errorHandler = () => JWTErrorHandler;

module.exports.issue = (payload) => {
  return jsonwebtoken.sign(payload, secret);
};

module.exports.getUserFromToken = (token) => {
  const payload = jsonwebtoken.decode(token.replace(/bearer /gi, ''));
  return payload.user;
};
