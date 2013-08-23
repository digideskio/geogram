
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , mainApp = require('./routes/main')
  , path = require('path')
  , qs = require('querystring')
  , app = express(app)
  , server = require('http').createServer(app)
  , io = require('engine.io').attach(server)
  , Jobber = require(path.resolve(__dirname, 'plugins/jobber/jobber.js'))
  , jobber
  , webSocketReference
  ;

// all environments

var package = require(path.resolve(__dirname, './package.json'))

// Setup local variables to be available in the views.
app.locals.title = "Geogram by Joe McCann"
app.locals.description = "Geogram • Capture Instagrams in a Geofenced Region"
app.locals.node_version = process.version.replace('v', '')
app.locals.app_version = package.version
app.locals.env = process.env.NODE_ENV

app.set('port', process.env.PORT || 3030)
app.set('views', __dirname + '/views')
app.set('view engine', 'ejs')
app.use(express.favicon())
app.use(express.logger(app.locals.env === 'production' ? 'tiny' : 'dev' ))
app.use(express.compress())
app.use(express.bodyParser())
app.use(express.methodOverride())
app.use(app.router)
app.use(require('stylus').middleware(__dirname + '/public'))
app.use(express.static(path.join(__dirname, 'public')))
app.use(express.directory(__dirname + '/public'));


// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler())
}

// Core routes
app.get('/', routes.index)

app.get('/showme', routes.showme)

app.post('/search/geo', mainApp.search_geo_post)

io.on('connection', function(socket){

  webSocketReference = socket

  socket.on('message', function(v){
  	
		try{v = JSON.parse(v)}catch(e){}

    // console.dir(v)

    // if we're conducting a search...
  	if(v.type && (v.type == 'geogram-search')){

			var d = qs.parse(v.data)

      // Add ID here for each unique job
      if(d.minUTC || d.maxUTC){

        // we stringify it back so the qs params are a single unique string
        var uniqueJobId = jobber.createUniqueJobId(qs.stringify(d))

        // Check to see if job exists
        jobber.doesJobExist(uniqueJobId,function doesJobExistCb(err,data){

          if(err) return console.error(err)

          jobber.createJob(d,uniqueJobId,function createJobCb(err,data){

            if(err) return console.error(err)

            else console.log(data || "Job created for id %s".green, uniqueJobId)

          }) // end createJob()

        }) // end doesJobExist

      }

			mainApp.realtime_search_geo(d,socket,v.type,function realtime_search_geoCb(err,data){

				if(err){
					console.error(err)
		    	socket.send(JSON.stringify({data:err,type:v.type,error:true}))
		    }
		    else {
		    	// console.log(data)
		    	socket.send(JSON.stringify({data:data,type:v.type}))
		    }
			
			}) // end realtime_search_geo()

  	}

    // if we're fetching a list of all couchdb docs...
    if(v.type && (v.type == 'list-all-couchdb-docs')){

      mainApp.fetchAllDocs(function(err,data){

        if(err){
          console.error(err)
          socket.send(JSON.stringify({data:err,type:v.type,error:true}))
        }
        else {
          // console.log(data)
          socket.send(JSON.stringify({data:data,type:v.type}))
        }
      
      }) // end fetchAllDocs()

    }

    // if we're fetching an individual doc...
    if(v.type && (v.type == 'get-couchdb-doc-data')){

      mainApp.fetchFromCouch(v.data, function(err,data){

        if(err){
          console.error(err)
          socket.send(JSON.stringify({data:err,type:v.type,error:true}))
        }
        else {
          // console.log(data)
          socket.send(JSON.stringify({data:data,type:v.type}))
        }
      
      }) // end fetchAllDocs()

    }

    // Just a friendly game of...
  	if(v == 'ping'){ socket.send('pong')}

  }) // end onmessage

}) // end io connection


server.listen(process.env.PORT || 3030, function(){

  console.log("\033[96m\nhttp://127.0.0.1:" + app.get('port') +"\033[96m\n")

  jobber = new Jobber(mainApp, webSocketReference)

  jobber.initializeJobs()

});



// Dirty

// catch the uncaught errors that weren't wrapped in a domain or try catch statement
// do not use this in modules, but only in applications, as otherwise we could have multiple of these bound
process.on('uncaughtException', function(err) {
    // handle the error safely
    console.error(err)
    console.trace(err.stack)
});