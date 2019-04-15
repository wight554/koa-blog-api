const Koa = require('koa'),
  app = new Koa();

const mongo = require('./utils/mongo'),
  { Post, User, ObjectId } = mongo;

// body parser
const bodyParser = require('koa-bodyparser')
app.use(bodyParser())

const { errorHandler, jwt, issue }  = require("./jwt");

// authentication
require('./utils/passport')
const passport = require('koa-passport')
app.use(passport.initialize())

const cors = require('@koa/cors');
app.use(cors({
  origin: '*'
}));

// routes
const router = require('koa-joi-router')
const public = router(),
  secured = router(),
  { Joi } = router;

app.use(public.middleware())
app.use(secured.middleware())
secured.use(errorHandler()).use(jwt())

public.prefix('/api')
secured.prefix('/api')

public
  .get('/posts', async ctx => {
    const posts = await Post.find({})
    ctx.body = posts
  })
  .post("/login", bodyParser(), async ctx => {
    await passport.authenticate('local', (error, user) => {
      if (user == false || error) {
        throw Error(error || 'Authorization error')
      } else {
        const payload = {
          id: user.id,
          username: user.username,
        }
        const token = issue({ user: payload })
        ctx.body = { ...payload, token }
      }
    })(ctx)
  })
  .route({
    method: 'post',
    path: '/register',
    validate: {
      body: {
        username: Joi.string().max(100),
        password: Joi.string().max(100),
      },
      type: 'json',
    },
    handler: async ctx => {
      const user = await new User(ctx.request.body);
      try {
        await user.save();
        ctx.body = await user;
      } catch(err) {
        ctx.status = 403
        ctx.body = { message: err}
      }
    }
  })

secured
  .post('/posts', bodyParser(), async ctx => {
    const post = new Post(ctx.request.body)
    await post.save();
    ctx.body = await post;
  })
  .delete('/posts/:id', async ctx => {
    await Post.deleteOne({ _id: ObjectId(ctx.params.id) })
    ctx.body = { message: "Successfully deleted" };
  })
  .put('/posts/:id', bodyParser(), async ctx => {
    await Post.updateOne({ _id: ObjectId(ctx.params.id) }, {$set: {"name": ctx.request.body.name}})
    ctx.body = { message: "Successfully updated" };
  })
  .post('/posts/:id/comments/', bodyParser(), async ctx => {
    const commentId = ObjectId();
    await Post.updateOne({ _id: ObjectId(ctx.params.id) },
      {$addToSet: {comments: {_id: commentId, name: ctx.request.body.name,
        author: await ctx.request.body.author}}}
    )
    const commentsDocument = await Post.findOne({_id: ctx.params.id},{comments: {$elemMatch: {_id: commentId}}});
    ctx.body = commentsDocument.comments[0];
  })
  .delete('/posts/:id/comments/:cid/', async ctx => {
    await Post.updateOne({ _id: ObjectId(ctx.params.id) },
      {$pull: {comments: {_id: ObjectId(ctx.params.cid)}}})
    ctx.body = { message: "Successfully deleted comment" };
  })
  .put('/posts/:id/comments/:cid/', bodyParser(), async ctx => {
    await Post.updateOne(
      { _id: ObjectId(ctx.params.id), "comments._id": ObjectId(ctx.params.cid) },
      { $set: { "comments.$.name" : ctx.request.body.name } }
   )
   ctx.body = { message: "Successfully updated comment" };
  })

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on', port))