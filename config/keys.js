module.exports = {
    mongoUrl: process.env.MONGODB_URI || 'mongodb://localhost:27017/blog',
    secret: process.env.SECRET || 'smth'
};