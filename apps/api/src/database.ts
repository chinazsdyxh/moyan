import { Client } from 'pg';

// 创建数据库连接
const client = new Client({
    host: '127.0.0.1',      // 你的数据库地址
    port: 54321,            // 金仓默认端口
    database: 'test',       // 数据库名
    user: 'system',         // 用户名
    password: '123456',     // 你的密码
});

// 连接数据库
client.connect()
    .then(() => console.log('金仓数据库连接成功！'))
    .catch((err: Error) => console.error('数据库连接失败：', err));

export default client;