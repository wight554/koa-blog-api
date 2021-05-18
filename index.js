const Koa = require('koa'),
  app = new Koa();

const mongo = require('./utils/mongo'),
  { Post, User, ObjectId } = mongo;

// body parser
const bodyParser = require('koa-bodyparser');
app.use(bodyParser());

const { errorHandler, getUserFromToken, jwt, issue } = require('./utils/jwt');

// authentication
require('./utils/passport');
const passport = require('koa-passport');
app.use(passport.initialize());

const cors = require('@koa/cors');
app.use(
  cors({
    origin: '*',
  })
);

// routes
const router = require('koa-joi-router');
const public = router(),
  secured = router(),
  { Joi } = router;

app.use(public.middleware());
app.use(secured.middleware());
secured.use(errorHandler()).use(jwt());

public.prefix('/api');
secured.prefix('/api');

public
  .get('/posts', async (ctx) => {
    const posts = await Post.find({});
    ctx.body = posts;
  })
  .get('/posts/:id', async (ctx) => {
    const posts = await Post.find({ _id: ObjectId(ctx.params.id) });
    ctx.body = posts[0];
  })
  .post('/login', bodyParser(), async (ctx) => {
    await passport.authenticate('local', (error, user) => {
      if (user == false || error) {
        ctx.status = 401;
        ctx.body = { message: error || 'Authorization error' };
      } else {
        const payload = {
          id: user.id,
          username: user.username,
          firstName: user.firstName,
          lastName: user.lastName,
        };
        const token = issue({ user: payload });
        ctx.body = { ...payload, token };
      }
    })(ctx);
  })
  .route({
    method: 'post',
    path: '/register',
    validate: {
      body: {
        username: Joi.string().max(100),
        firstName: Joi.string().max(100).optional().allow(''),
        lastName: Joi.string().max(100).optional().allow(''),
        password: Joi.string().max(100),
      },
      type: 'json',
      continueOnError: true,
    },
    handler: async (ctx) => {
      if (ctx.invalid && typeof ctx.invalid !== 'undefined') {
        ctx.status = ctx.invalid.body.status;
        return (ctx.body = { message: ctx.invalid.body.msg });
      }
      const user = await new User(ctx.request.body);
      try {
        await user.save();
        ctx.body = { ...(await user), password: undefined };
      } catch (err) {
        ctx.body = { message: err.message };
        ctx.status = 403;
      }
    },
  });

secured
  .post('/posts', bodyParser(), async (ctx) => {
    const post = new Post(ctx.request.body);
    await post.save();
    ctx.body = await post;
  })
  .delete('/posts/:id', async (ctx) => {
    const isAuthor = await checkPostAuthor(ctx.headers.authorization, ctx.params.id);
    if (isAuthor) {
      await Post.deleteOne({ _id: ObjectId(ctx.params.id) });
      return (ctx.body = { message: 'Successfully deleted' });
    } else {
      ctx.status = 400;
      ctx.body = { message: 'You are not the author' };
    }
  })
  .put('/posts/:id', bodyParser(), async (ctx) => {
    const isAuthor = await checkPostAuthor(ctx.headers.authorization, ctx.params.id);
    if (isAuthor) {
      await Post.updateOne({ _id: ObjectId(ctx.params.id) }, { $set: { name: ctx.request.body.name } });
      ctx.body = { message: 'Successfully updated' };
    } else {
      ctx.status = 400;
      ctx.body = { message: 'You are not the author' };
    }
  })
  .post('/posts/:id/comments/', bodyParser(), async (ctx) => {
    const commentId = ObjectId();
    await Post.updateOne(
      { _id: ObjectId(ctx.params.id) },
      {
        $addToSet: { comments: { _id: commentId, ...(await ctx.request.body) } },
      }
    );
    const commentsDocument = await Post.findOne(
      { _id: ctx.params.id },
      { comments: { $elemMatch: { _id: commentId } } }
    );
    ctx.body = commentsDocument.comments[0];
  })
  .delete('/posts/:id/comments/:cid/', async (ctx) => {
    const isAuthor = await checkCommentAuthor(ctx.headers.authorization, ctx.params.id, ctx.params.cid);
    if (isAuthor) {
      await Post.updateOne(
        { _id: ObjectId(ctx.params.id) },
        { $pull: { comments: { _id: ObjectId(ctx.params.cid) } } }
      );
      ctx.body = { message: 'Successfully deleted comment' };
    } else {
      ctx.status = 400;
      ctx.body = { message: 'You are not the author' };
    }
  })
  .put('/posts/:id/comments/:cid/', bodyParser(), async (ctx) => {
    const isAuthor = await checkCommentAuthor(ctx.headers.authorization, ctx.params.id, ctx.params.cid);
    if (isAuthor) {
      await Post.updateOne(
        { _id: ObjectId(ctx.params.id), 'comments._id': ObjectId(ctx.params.cid) },
        { $set: { 'comments.$.name': ctx.request.body.name } }
      );
      ctx.body = { message: 'Successfully updated comment' };
    } else {
      ctx.status = 400;
      ctx.body = { message: 'You are not the author' };
    }
  })
  .route({
    method: 'put',
    path: '/update-user',
    validate: {
      body: {
        username: Joi.string().max(100).optional().allow(''),
        firstName: Joi.string().max(100).optional().allow(''),
        lastName: Joi.string().max(100).optional().allow(''),
        password: Joi.string().max(100).optional().allow(''),
        id: Joi.string().max(100),
      },
      type: 'json',
      continueOnError: true,
    },
    handler: async (ctx) => {
      if (ctx.invalid && typeof ctx.invalid !== 'undefined') {
        ctx.status = ctx.invalid.body.status;
        return (ctx.body = { message: ctx.invalid.body.msg });
      }
      const isCurrentUser = await checkCurrentUser(ctx.headers.authorization, ctx.request.body.id);
      if (isCurrentUser) {
        try {
          const { username, firstName, lastName, id, password } = ctx.request.body;
          const newUser = {
            username,
            firstName,
            lastName,
            id,
          };
          if (password) {
            newUser.password = password;
          }
          await User.updateOne({ _id: ObjectId(ctx.request.body.id) }, { $set: { ...newUser } });
          const users = await User.find({ _id: ObjectId(ctx.request.body.id) });
          const user = users[0];
          const payload = {
            id: user.id,
            username: user.username,
            firstName: user.firstName,
            lastName: user.lastName,
          };
          const token = issue({ user: payload });
          ctx.body = { ...payload, token };
        } catch (err) {
          ctx.body = { message: err.message };
          ctx.status = 403;
        }
      } else {
        ctx.status = 400;
        ctx.body = { message: 'You are not allowed to do this' };
      }
    },
  });

const checkCurrentUser = (token, id) => {
  const user = getUserFromToken(token);
  return User.findById(ObjectId(id)).then((u) => u.id === user.id);
};

const checkPostAuthor = (token, pid) => {
  const user = getUserFromToken(token);
  return Post.findById(ObjectId(pid)).then((post) => post.author === user.username);
};

const checkCommentAuthor = (token, pid, cid) => {
  const user = getUserFromToken(token);
  return Post.findOne({ _id: pid }, { comments: { $elemMatch: { _id: cid } } }).then(
    (post) => post.comments[0].author === user.username
  );
};
const port = process.env.PORT || 8000;
app.listen(port, () => console.log('Server listening on', port));
