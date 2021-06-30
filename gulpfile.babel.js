const fs = require("fs");
const gulp = require('gulp');
const {merge} = require('event-stream');
const browserify = require('browserify');
const source = require('vinyl-source-stream');
const buffer = require('vinyl-buffer');
const rename = require('gulp-rename');
const preprocessify = require('preprocessify');
const gulpif = require("gulp-if");
const through = require('through2')
const terser = require('gulp-terser');
var deasync = require('deasync');
const $ = require('gulp-load-plugins')();
var runSequence = require('run-sequence').use(gulp);
var production = process.env.NODE_ENV === "production";
var target = process.env.TARGET || "chrome";
var environment = process.env.NODE_ENV || "development";
var mv = process.env.NODE_MV || "3"; // Defaults to manifest v3

var generic = JSON.parse(fs.readFileSync(`./config/${environment}.json`));
var specific = JSON.parse(fs.readFileSync(`./config/${target}.json`));
var context = Object.assign({}, generic, specific);

var manifest = {
  dev: {
    "background": {
      "scripts": [
        "scripts/livereload.js",
        "background.js"
      ]
    }
  },

  firefox: {
    "applications": {
      "gecko": {
        "id": "my-app-id@mozilla.org"
      }
    }
  }
}

// Tasks
gulp.task('clean', () => {
  return pipe(`./build_MV${mv}/${target}`, $.clean())
})

gulp.task(`build_MV${mv}`,(cb)=>{gulp.series(['clean', 'styles', 'ext', (cb2)=>{cb2();cb()}]).apply()});




gulp.task('watch', gulp.parallel([`build_MV${mv}`]), () => {
  $.livereload.listen();

  gulp.watch(['./src/**/*']).on("change", () => {
    var task = gulp.series([`build_MV${mv}`, $.livereload.reload]);
    task();
  });
});

gulp.task('default', gulp.parallel([`build_MV${mv}`]));


if (mv == "3") {
  gulp.task('ext', (cb2)=>{ gulp.series([`manifestv${mv}`, 'rules', 'js',(cb)=>{ mergeAll(target);cb();cb2()}]).apply()});
} else {
  gulp.task('ext', (cb2)=>{ gulp.series([`manifestv${mv}`, 'js',(cb)=>{ mergeAll(target);cb();cb2()}]).apply()});
}



// -----------------
// COMMON
// -----------------
gulp.task('js', () => {
  return new Promise(function(resolve, reject) {
  var i = 0;
  const files = [
    'searchRoutine/searchRoutineWipe.js',
    'searchRoutine/searchRoutineCountdown.js',
    'searchRoutine/searchRoutineMediate.js',
    'utils/utilitiesCrossBrowser.js',
    'utils/utilitiesAssistant.js',
    'utils/utilitiesStorage.js',
    'background.js',
    'popup.js',
    'alarms.js',
    'config.js',
    'livereload.js',
    'registrationRoutine/registrationBegin.js',
    'registrationRoutine/registrationEnd.js'
  ]
  let tasks = files.map( file => {

    var entry = 'src/scripts/' + file;
    var entry_dest = `build_MV${mv}/${target}/scripts`;

    if (file == "background.js") {
      entry = "src/background.js";
      entry_dest = `build_MV${mv}/${target}`;
    }
    return browserify({
      entries: entry,
      debug: true
    })
    .transform('babelify', { presets: ['@babel/preset-env'] })
    .transform(preprocessify, {
      includeExtensions: ['.js'],
      context: context
    })
    .bundle()
    .pipe(source(file))
    .pipe(buffer())
    .pipe(gulpif(!production, $.sourcemaps.init({ loadMaps: true }) ))
    .pipe(gulpif(!production, $.sourcemaps.write('./') )) /*    .pipe(terser())*/
    .pipe(gulp.dest(entry_dest))
    .pipe(through.obj((chunk, enc, cb) => {
      i ++;
      cb(null, chunk);
      if (i == files.length) {
        resolve();
      }
    }))
  });
  return merge.apply(null, tasks);
})})

/*
    .pipe($.plumber())
    .pipe($.sass.sync({
      outputStyle: 'expanded',
      precision: 10,
      includePaths: ['.']
    }).on('error', $.sass.logError))*/
gulp.task('styles', () => {
  return gulp.src('src/resources/**/*.css', { allowEmpty: true})
    .pipe(gulp.dest(`build_MV${mv}/${target}/resources`));
});

gulp.task(`manifestv${mv}`, () => {
  return gulp.src(`./manifestv${mv}.json`, { allowEmpty: true})
    .pipe(rename('manifest.json'))
    .pipe(gulpif(!production, $.mergeJson({
      fileName: `manifestv${mv}.json`,
      jsonSpace: " ".repeat(4),
      endObj: manifest.dev
    })))
    .pipe(gulpif(target === "firefox", $.mergeJson({
      fileName: `manifestv${mv}.json`,
      jsonSpace: " ".repeat(4),
      endObj: manifest.firefox
    })))
    .pipe(rename('manifest.json'))
    .pipe(gulp.dest(`./build_MV${mv}/${target}`))
});


// -----------------
// DIST
// -----------------
gulp.task('dist', () => {
  return new Promise(function(resolve, reject) {
    gulp.series(['build_MV${mv}', 'zip', ()=>{resolve();}]);
  })});

gulp.task('zip', () => {
  return pipe(`./build_MV${mv}/${target}/**/*`, $.zip(`${target}.zip`), './dist')
})

if (mv == "3") {
  gulp.task("rules", () => {
    return gulp.src('./rules.json', { allowEmpty: true})
      .pipe(gulp.dest(`./build_MV${mv}/${target}`))
  });
}





// Helpers
function pipe(src, ...transforms) {
  return transforms.reduce( (stream, transform) => {
    const isDest = typeof transform === 'string'
    return stream.pipe(isDest ? gulp.dest(transform) : transform)
  }, gulp.src(src, { allowEmpty: true}))
}

function mergeAll(dest) {
  return merge(
    pipe('./src/icons/**/*', `./build_MV${mv}/${dest}/icons`),
    pipe('./src/pages/**/*', `./build_MV${mv}/${dest}/pages`),
    pipe('./src/resources/**/*', `./build_MV${mv}/${dest}/resources`),
    pipe('./src/scrips/utils/**/*', `./build_MV${mv}/${dest}/utils`),
    pipe('./src/scrips/searchRoutine/**/*', `./build_MV${mv}/${dest}/searchRoutine`),
    pipe('./src/scrips/registrationRoutine/**/*', `./build_MV${mv}/${dest}/registrationRoutine`),
    pipe(['./src/_locales/**/*'], `./build_MV${mv}/${dest}/_locales`),
    pipe([`./src/images/${target}/**/*`], `./build_MV${mv}/${dest}/images`),
    pipe(['./src/images/shared/**/*'], `./build_MV${mv}/${dest}/images`),
    pipe(['./src/**/*.html'], `./build_MV${mv}/${dest}`)
  )
}
