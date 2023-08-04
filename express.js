const express = require("express");
const mysql = require("mysql2");
const dotenv = require("dotenv");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const compression = require("compression");
const helmet = require("helmet");
const nodemailer = require("nodemailer");
const multer = require("multer"); // Para manejar la carga de archivos
const upload = multer({ dest: "uploads/" }); // Carpeta donde se guardarán temporalmente los archivos
const fs = require("fs");
const path = require("path");


const app = express();
const port = process.env.PORT || 4000;

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
const limiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutos
  max: 100, // 100 peticiones por 10 minutos para toda la API
  trustProxy: true,
  handler: (req, res) => {
    res.status(429).json({
      error: "Limite de peticiones por servidor, intentanlo en 10 minutos",
    });
  },
});

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
    console.error("Error al conectar a la base de datos trabajo: ", err);
    return;
  }
  console.log("Conexión exitosa a la base de datos trabajo.");
});

app.post("/trabajo", limiter, upload.single("cv"), (req, res) => {
  const nombre = req.body.nombre;
  const apellido = req.body.apellido;
  const edad = req.body.edad;
  const telefono = req.body.telefono;
  const email = req.body.email;
  const provincia = req.body.provincia;
  const localidad = req.body.localidad;
  const dni = req.body.dni;
  const domicilio = req.body.domicilio;
  const cvFile = req.file;

  if (!cvFile) {
    return res.status(400).send("Debe cargar un archivo de CV en formato .png");
  }

  const sqlTrabajo =
    "INSERT INTO u352676213_form_trabajo (nombre, apellido, edad, telefono, email, provincia, localidad, dni, domicilio) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)";
  const valuesTrabajo = [
    nombre,
    apellido,
    edad,
    telefono,
    email,
    provincia,
    localidad,
    dni,
    domicilio,
  ];

  pool.getConnection((err, connection) => {
    if (err) {
      console.error(
        "Error al obtener una conexión de la base de datos trabajo: ",
        err
      );
      res
        .status(500)
        .send("Error al obtener una conexión de la base de datos trabajo.");
      return;
    }

    // Ejecutar la consulta en la conexión obtenida
    connection.query(sqlTrabajo, valuesTrabajo, (err, result) => {
      // Liberar la conexión una vez que hayamos terminado de usarla
      connection.release();

      if (err) {
        console.error(
          "Error al insertar datos en la base de datos de trabajo: ",
          err
        );
        res
          .status(500)
          .send("Error al insertar datos en la base de datos de trabajo.");
        return;
      }

      res.send(
        "Datos insertados correctamente en la base de datos de trabajo."
      );
    });
  });

  const transporter = nodemailer.createTransport({
    host: process.env.MAIL_HOST,
    port: process.env.MAIL_PORT,
    secure: true,
    auth: {
      user: process.env.MAIL_USER,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  const mailOptions = {
    from: process.env.MAIL_USER,
    to: "cv@asessaludsrl.com",
    subject: "Solicitud de trabajo",
    text: `Nombre: ${nombre}
Apellido: ${apellido}
Edad: ${edad}
Teléfono: ${telefono}
Email: ${email}
Provincia: ${provincia}
Localidad: ${localidad}
DNI: ${dni}
Domicilio: ${domicilio}`,
    attachments: [
      {
        filename: cvFile.originalname,
        path: cvFile.path,
      },
    ],
  };

  transporter.sendMail(mailOptions, (error, info) => {
    if (error) {
      console.log("Error al enviar el correo electrónico:", error);
      res.status(500).send("Error al enviar el correo electrónico.");
    } else {
      console.log("Correo electrónico enviado:", info.response);
      res.send("Datos enviados y correo electrónico enviado correctamente.");
    }

    // Elimina el archivo temporal después de enviar el correo electrónico (si existe)
    fs.unlink(cvFile.path, (err) => {
      if (err) {
        console.error("Error al eliminar el archivo temporal:", err);
      }
    });
  });
});

// Función para eliminar archivos temporales más antiguos de una carpeta
function limpiarArchivosTemporales(carpeta, edadMaximaEnMilisegundos) {
  fs.readdir(carpeta, (err, archivos) => {
    if (err) {
      console.error("Error al leer la carpeta de archivos temporales:", err);
      return;
    }

    const ahora = new Date().getTime();
    archivos.forEach((archivo) => {
      const rutaArchivo = path.join(carpeta, archivo);
      fs.stat(rutaArchivo, (err, stats) => {
        if (err) {
          console.error("Error al obtener las estadísticas del archivo:", err);
          return;
        }

        const tiempoCreacionArchivo = stats.birthtimeMs;
        if (ahora - tiempoCreacionArchivo > edadMaximaEnMilisegundos) {
          fs.unlink(rutaArchivo, (err) => {
            if (err) {
              console.error("Error al eliminar el archivo temporal:", err);
              return;
            }
            console.log("Archivo temporal eliminado:", rutaArchivo);
          });
        }
      });
    });
  });
}

// Llamar a la función cada cierto intervalo (por ejemplo, cada día)
const intervaloLimpiarArchivosTemporales = 24 * 60 * 60 * 1000; // 24 horas en milisegundos
setInterval(() => {
  limpiarArchivosTemporales("uploads/", intervaloLimpiarArchivosTemporales);
}, intervaloLimpiarArchivosTemporales);

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
