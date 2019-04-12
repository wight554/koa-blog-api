const Koa = require('koa'),
  app = new Koa();

const mongo = require('./utils/mongo'),
  Post = mongo.Post,
  User = mongo.User,
  ObjectId = mongo.ObjectId;

// trust proxy
app.proxy = true

// sessions
const session = require('koa-session')
app.keys = ['your-session-secret']
app.use(session({}, app))

// body parser
const bodyParser = require('koa-bodyparser')
app.use(bodyParser())

// authentication
require('./utils/passport')
const passport = require('koa-passport')
app.use(passport.initialize())

// routes
const router = require('koa-joi-router')
const public = router(),
  Joi = router.Joi;

app.use(public.middleware())

const cors = require('@koa/cors');
app.use(cors({
  origin: true,
  credentials: true
}));

public.prefix('/api')

public
  .get('/posts', async ctx => {
    const posts = await Post.find({})
    ctx.body = posts
  })
  .post('/posts', bodyParser(), async ctx => {
    const post = new Post(ctx.request.body)
    post.author = await ctx.state.user.username
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
        author: await ctx.state.user.username}}}
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
  .post('/login',
    passport.authenticate('local', {
      successRedirect: '/',
      failureRedirect: '/login'
    })
  )
  .route({
    method: 'post',
    path: '/signup',
    validate: {
      body: {
        username: Joi.string().max(100),
        password: Joi.string().max(100),
      },
      type: 'form',
    },
    handler: async ctx => {
      const user = await new User(ctx.request.body);
      try {
        await user.save();
        await ctx.redirect('/');
      } catch(err) {
        console.log(err)
      }
    }
  })
  .get('/logout', function(ctx) {
    ctx.logout()
    ctx.redirect('/')
  })
  .get('/users', async ctx => {
    const users = await User.find({})
    ctx.body = users
  })

const port = process.env.PORT || 3000;
app.listen(port, () => console.log('Server listening on', port))