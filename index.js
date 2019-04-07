const Koa = require('koa'),
  app = new Koa();

const render = require('koa-ejs'),
  serve = require('koa-static');

const path = require('path');

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
require('./utils/auth')
const passport = require('koa-passport')
app.use(passport.initialize())
app.use(passport.session())

// routes
const router = require('koa-joi-router')
const public = router(),
  Joi = router.Joi;

app.use(public.middleware())

app.use(serve(path.join(__dirname, 'public')))

render(app, {
  root: path.join(__dirname, 'views'),
  layout: false,
  viewExt: 'ejs',
  cache: false,
  debug: false
});

public
  .get('/', async ctx => {
    const posts = await Post.find({})
    await ctx.render('index', { posts })
  })
  .get('/posts/new', async ctx => {
    await ctx.render('new');
  })
  .get('/posts/:id', async ctx => {
    const post = await Post.findOne({ _id: ObjectId(ctx.params.id) })
    await ctx.render('show', { post });
  })
  .get('/posts/:id/edit', async ctx => {
    const post = await Post.findOne({ _id: ObjectId(ctx.params.id) })
    await ctx.render('edit', message = post, type="post");
  })
  .post('/posts/add', bodyParser(), async ctx => {
    const post = new Post(ctx.request.body)
    post.author = await ctx.state.user.username
    await post.save();
    await ctx.redirect('/');
  })
  .post('/posts/:id/delete', async ctx => {
    await Post.deleteOne({ _id: ObjectId(ctx.params.id) })
    await ctx.redirect('/');
  })
  .post('/posts/:id/update', bodyParser(), async ctx => {
    await Post.updateOne({ _id: ObjectId(ctx.params.id) }, {$set: {"name": ctx.request.body.name}})
    await ctx.redirect('/');
  })
  .post('/posts/:id/comments/add', bodyParser(), async ctx => {
    await Post.updateOne({ _id: ObjectId(ctx.params.id) },
     {$addToSet: {comments: {_id: ObjectId(), name: ctx.request.body.name,
        author: await ctx.state.user.username}}})
    await ctx.redirect(`/posts/${ctx.params.id}`)
  })
  .get('/posts/:id/comments/:cid/edit', async ctx => {
    const post = await Post.findOne({ _id: ObjectId(ctx.params.id) })
    const comment = post.comments.find(comment => (comment._id.toString() === ctx.params.cid))
    await ctx.render('edit', message = comment, postid = ctx.params.id, type="comment");
  })
  .post('/posts/:id/comments/:cid/delete', async ctx => {
    await Post.updateOne({ _id: ObjectId(ctx.params.id) },
      {$pull: {comments: {_id: ObjectId(ctx.params.cid)}}})
    await ctx.redirect(`/posts/${ctx.params.id}`);
  })
  .post('/posts/:id/comments/:cid/update', bodyParser(), async ctx => {
    await Post.updateOne(
      { _id: ObjectId(ctx.params.id), "comments._id": ObjectId(ctx.params.cid) },
      { $set: { "comments.$.name" : ctx.request.body.name } }
   )
    await ctx.redirect(`/posts/${ctx.params.id}`);
  })
  .post('/login',
    passport.authenticate('local', {
      successRedirect: '/',
      failureRedirect: '/login'
    })
  )
  .get('/login', async ctx => {
    await ctx.render('login');
  })
  .get('/register', async ctx => {
    await ctx.render('register', title = "Register user" );
  })
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
        await ctx.render('err', { err }) 
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