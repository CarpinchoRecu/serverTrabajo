const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");
const multer = require('multer');
const nodemailer = require('nodemailer');
const path = require('path');
const compression = require("compression");
const helmet = require("helmet");

const app = express();
const port = process.env.PORT || 3000;

// Cargar las variables de entorno desde el archivo .env
dotenv.config();

app.use(express.urlencoded({ extended: true }));

// Middleware de CORS
app.use(cors());

// Middleware de Compression
app.use(compression());

// Middleware de Helmet
app.use(helmet());

// Middleware para rate limit general de la API
const limiterGeneral = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 100, // 100 peticiones por 10 minutos para toda la API
  trustProxy: true,
  handler: (req, res) => {
    res.status(429).json({
      error:
        "Limite de peticiones por servidor, intentanlo en 10 minutos",
    });
  },
});

app.use("/", limiterGeneral);

// Crear la conexión a la base de datos al iniciar el servidor
const pool = mysql.createPool({
  connectionLimit: 10,
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_DATABASE,
});

pool.getConnection((err, connection) => {
  if (err) {
    console.error("Error al conectar a la base de datos: ", err);
    return;
  }
  console.log("Conexión exitosa a la base de datos.");
});


app.post("/", limiterGeneral, (req, res) => {
  const nombre = req.body.nombre;
  const apellido = req.body.apellido;
  const edad = req.body.edad;
  const telefono = req.body.telefono;
  const email = req.body.email;
  const provincia = req.body.provincia;
  const localidad = req.body.localidad;

  const sqlContactanos =
    "INSERT INTO u352676213_form_contactos (nombre, apellido, edad, telefono, email, provincia, localidad) VALUES (?, ?, ?, ?, ?, ?, ?)";
  const valuesContactanos = [
    nombre,
    apellido,
    edad,
    telefono,
    email,
    provincia,
    localidad,
  ];

  pool.getConnection((err, connection) => {
    if (err) {
      console.error("Error al obtener una conexión de la base de datos: ", err);
      res
        .status(500)
        .send("Error al obtener una conexión de la base de datos.");
      return;
    }

    // Ejecutar la consulta en la conexión obtenida
    connection.query(sqlContactanos, valuesContactanos, (err, result) => {
      // Liberar la conexión una vez que hayamos terminado de usarla
      connection.release();

      if (err) {
        console.error(
          "Error al insertar datos en la base de datos de contactos: ",
          err
        );
        res
          .status(500)
          .send("Error al insertar datos en la base de datos de contactos.");
        return;
      }

      res.send(
        "Datos insertados correctamente en la base de datos de contactos."
      );
    });
  });
});

app.options("*", function (req, res) {
  res.sendStatus(200);
});

app.use(function (err, req, res, next) {
  if (err.name === "UnauthorizedError") {
    res.status(401).json({ error: "No autorizado" });
  }
});

app.listen(port, () => {
  console.log(`Servidor Express en funcionamiento en el puerto ${port}`);
});
