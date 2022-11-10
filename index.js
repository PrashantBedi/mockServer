module.exports = (db) => {
    const data = { users: [], login: [] }
    // Create 1000 users
    for (let i = 0; i < 10; i++) {
      db.users.push({ id: i, name: `user${i}` })
    }

    for (let i = 0; i < 10; i++) {
        db.login.push({ id: i, username: `user${i}`, token:`rabsfabfakbo21y4fbie${i}` })
    }

    return db
  }