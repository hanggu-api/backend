const bcrypt = require('bcrypt');
const senhaTeste = 'minhasenhateste123';
const saltRounds = 10;

bcrypt.hash(senhaTeste, saltRounds, function(err, hash) {
  if (err) {
    console.error("Erro ao gerar hash:", err);
    return;
  }
  console.log("Senha Original:", senhaTeste);
  console.log("HASH GERADO (use este valor no MySQL):", hash);
});