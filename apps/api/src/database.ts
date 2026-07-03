import { Client } from 'pg';
import { config } from './config.js';

// 创建数据库连接
const client = new Client({
    host: config.db.host,      // 你的数据库地址
    port: config.db.port,            // 金仓默认端口
    database: config.db.database,       // 数据库名
    user: config.db.user,         // 用户名
    password: config.db.password,     // 你的密码
});

// 连接数据库
client.connect()
    .then(() => console.log('金仓数据库连接成功！'))
    .catch((err: Error) => console.error('数据库连接失败：', err));

export default client;