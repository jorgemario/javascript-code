/**
 * Note: only the first "file" in the form is sent to the server, 
 * along with all normal form elements (input, textarea, select, etc)
 */
Ajax.Upload = Class.create(Ajax.Request, {
	initialize : function($super, options) {
		$super(options.url, options);
		this.transport.isXHR = true;
	},
	
	/**
	 * Extends Prototype's Ajax API to support the upload of single files.
	 * Based on code from <a href="https://github.com/New-Bamboo/example-ajax-upload/blob/master/public/index.html">HTML5-powered Ajax file uploads</a> 
	 */
	request: function(url) {
		var formData = new FormData(),
			$form = this.options.context,
			fileInput = this.options.fileInput,
			log = this.options.log,
			hasOwn = Object.prototype.hasOwnProperty,
			h = $form.serialize(true);
		
		this.method = "POST";
		this.url = url;
        
        // add form elements to FormData object
        for (var el in h) {
        	if (hasOwn.call(h, el)) {
        		log("formData.append(", el, ",", h[el], ")");
        		formData.append(el, h[el]);
        	}
        }

        // add only the first file
        formData.append(fileInput.name, fileInput.files[0]);
        log("formData.append(", fileInput.name, ") <-- file");
        
        try {
            var response = new Ajax.Response(this);
            if (this.options.onCreate) {
            	this.options.onCreate.call(this.options.context, {
            		method: this.method,
            		url: this.url,
            		options: this.options,
            		isXHR: true
            	});
            }
            Ajax.Responders.dispatch('onCreate', this, response);
            
	        // Set up request
	        this.transport.open(this.method, this.url, true);
	        
	        // Set up events
	        this.transport.upload.addEventListener('progress', this.onUploadProgress.bind(this), false);
	        
	        this.respondToReadyState.bind(this).defer(1);
	        
	        this.transport.onreadystatechange = this.onStateChange.bind(this);
	        this.setRequestHeaders();
	
	        // Fire!
	        this.transport.send(formData);
        }
        catch (e) {
        	this.dispatchException(e);
        }
	},
	
	onUploadProgress: function(event) {
		var percent = 0;
        var position = event.loaded || event.position; /*event.position is deprecated*/
        var total = event.total;
        if (event.lengthComputable) {
            percent = Math.ceil(position / total * 100);
        }
        this.options.onProgress(event, position, total, percent);
	}
});

/**
 * Original code from <a href="http://www.malsup.com/jquery/form/">jQuery Form Plugin</a>
 * 
 * @param f the form element with the file to be uploaded
 * @param s the argument options (can be null)
 * @returns
 */
function FileUpload(f, s) {
	var $form = $(f),
		feature = {},
		fileInputs = $form.select('input[type=file]:enabled'),
		inputValue = (fileInputs.length > 0) ? $F(fileInputs[0]) : "",
		options,
		fileAPI,
		xhr;
    
    if (inputValue === "") {
    	return {
    		upload: function() { log("No file selected."); },
    		abort: Prototype.emptyFunction
    	};
    }
    
    options = Object.extend({
    	// default options
    	debug: false, 
    	iframe: false,
    	url: $form.readAttribute('action'),
    	//contentType: "",
    	dataType: "json",
    	encoding: "multipart/form-data",
    	onProgress: Prototype.emptyFunction,
    	beforeSend: function() { return true; }
    }, s || {}); // merge defaults with argument options
    
    // set the context
    options.context = $form;
    options.fileInput = fileInputs[0];
    options.log = log;
    options.method = "POST";
    
    // do not upload if beforeSend returns false
    if (options.beforeSend.call(options.context) === false) {
    	return { 
    		upload : function() { log("Submit canceled by beforeSend()."); },
    		abort: Prototype.emptyFunction
    	};
    }
    
	/**
	 * Feature detection
	 */
	feature.fileapi = new Element("input", {type: "file"}).files !== undefined;
	feature.formdata = window.FormData !== undefined;
	
	fileAPI = feature.fileapi && feature.formdata;
    log("fileAPI: " + fileAPI);

    // options.iframe allows user to force iframe mode
    if (options.iframe !== false || !fileAPI) {
    	log("Iframe Upload selected");
    	xhr = fileUploadIframe();
    } 
    else {
    	log("XHR Upload selected");
    	xhr = {
    		doSubmit: function() {
    			new Ajax.Upload(options);
    		},
    		doAbort: function() {
    			log("Abort not yet supported.");
    			return;
    		}
    	};
    }
    
    return {
    	upload: function() {
    		// fire 'submit' event
    		Event.fire($form, "FileUpload:submit", {options: options});
    		xhr.doSubmit();
    	},
    	abort: function() {
    		xhr.doAbort();
    	}
    };
    
    
    // private function for handling file uploads (hat tip to YAHOO!)
    function fileUploadIframe() {
    	var timedOut, 
    		timeoutHandle,
    		id = 'uploadIframeIO' + (new Date().getTime()),
    		iframeSrc = /^https/i.test(window.location.href || '') ? 'javascript:false' : 'about:blank',
    		$io = new Element("iframe", {"name": id, "src": iframeSrc, "style": "position: 'absolute'; top: '-1000px'; left: '-1000px'; width: 0px; height: 0px;"})
    		xhr;
    	
        log("iframeSrc:", iframeSrc);

        xhr = { // mock object
            aborted: 0,
            responseText: null,
            responseXML: null,
            responseJSON: null,
            status: 0,
            statusText: 'n/a',
            getAllResponseHeaders: function() {},
            getResponseHeader: function() {},
            setRequestHeader: function() {},
            abort: function(status) {
                var e = (status === 'timeout' ? 'timeout' : 'aborted');
                log('aborting upload... ' + e);
                this.aborted = 1;

                try { // #214, #257
                    if ($io.contentWindow.document.execCommand) {
                        $io.contentWindow.document.execCommand('Stop');
                    } 
                    else if ($io.contentWindow.stop) {
                    	$io.contentWindow.stop();
                    }
                }
                catch(ignore) {}

                $io.writeAttribute('src', iframeSrc); // abort op in progress
                xhr.error = e;
                if (options.onFailure) {
                    options.onFailure.call(options.context, xhr, e, status);
                }
                
                Event.fire($form, "FileUpload:abort", {options: options});
                
                if (options.onComplete) {
                    options.onComplete.call(options.context, xhr, e);
                }
            }
        };
        
        /*if (options.beforeSend && options.beforeSend.call(options.context, {transport: xhr}) === false) {
        	return { doSubmit : function() {}}; // do not submit if beforeSend returns false
        }*/
        
        var CLIENT_TIMEOUT_ABORT = 1;
        var SERVER_ABORT = 2;
                
        function getDoc(frame) {
            /* it looks like contentWindow or contentDocument do not
             * carry the protocol property in ie8, when running under ssl
             * frame.document is the only valid response document, since
             * the protocol is know but not on the other two objects. strange?
             * "Same origin policy" http://en.wikipedia.org/wiki/Same_origin_policy
             */
            
            var doc = null;
            
            // IE8 cascading access check
            try {
                if (frame.contentWindow) {
                    doc = frame.contentWindow.document;
                }
            } catch(err) {
                // IE8 access denied under ssl & missing protocol
                log('cannot get iframe.contentWindow document: ' + err);
            }

            if (doc) { // successful getting content
                return doc;
            }

            try { // simply checking may throw in ie8 under ssl or mismatched protocol
                doc = frame.contentDocument ? frame.contentDocument : frame.document;
            } catch(err) {
                // last attempt
                log('cannot get iframe.contentDocument: ' + err);
                doc = frame.document;
            }
            return doc;
        }

        function _doSubmit() {
            // make sure form attrs are set
            var t = $form.readAttribute('target'), 
                a = $form.readAttribute('action'),
                md = $form.readAttribute('method'),
                mp = 'multipart/form-data',
                et = $form.readAttribute('enctype') || $form.readAttribute('encoding') || mp;

            // update form attrs in IE friendly way
            $form.writeAttribute('target',id);
            
            if (!/post/i.test(md)) {
            	$form.writeAttribute('method', options.method);
            }
            
            // ie borks in some cases when setting encoding
            $form.writeAttribute({
            	encoding: mp, 
            	enctype: mp
            });
            
            if (a != options.url) {
            	$form.writeAttribute('action', options.url);
            }

            // support timeout
            if (options.timeout) {
                timeoutHandle = setTimeout(function() { timedOut = true; cb(CLIENT_TIMEOUT_ABORT); }, options.timeout);
            }

            // look for server aborts
            function checkState() {
                try {
                    var state = getDoc($io).readyState;
                    log('state = ' + state);
                    if (state && state.toLowerCase() == 'uninitialized') {
                        setTimeout(checkState,50);
                    }
                }
                catch(e) {
                    log('Server abort: ' , e, ' (', e.name, ')');
                    cb(SERVER_ABORT);
                    if (timeoutHandle) {
                        clearTimeout(timeoutHandle);
                    }
                    timeoutHandle = undefined;
                }
            }

            try {
                // add iframe to doc and submit the form
                $(document.body).insert({bottom: $io});
                
                if ($io.attachEvent) {
                    $io.attachEvent('onload', cb);
                }
                else {
                    $io.addEventListener('load', cb, false);
                }
                setTimeout(checkState,15);

                try {
                	if (options.onCreate) {
                    	options.onCreate.call(options.context, {
                    		method: options.method,
                    		url: options.url,
                    		options: options,
                    		isXHR: false
                    	});
                    }
                	
                    $form.submit();
                    
                } catch(err) {
                	log("Error submitting form: ", err);
                    // just in case form has element with name/id of 'submit'
                    //var submitFn = document.createElement('form').submit;
                    //submitFn.apply(form);
                }
            }
            finally {
                // reset form attrs
                $form.writeAttribute('action', a);
                $form.writeAttribute('enctype', et); // #380
                $form.writeAttribute('target', t || '');
                $form.writeAttribute('method', md || '');
            }
        }
        
        // take a breath so that pending repaints get some cpu time before the upload starts
        function doSubmit() {
        	setTimeout(_doSubmit, 10); // this lets dom updates render
        }

        var doc, domCheckCount = 50, callbackProcessed;

        function cb(e) {
            if (xhr.aborted || callbackProcessed) {
                return;
            }
            
            doc = getDoc($io);
            if(!doc) {
                log('cannot access response document');
                e = SERVER_ABORT;
            }
            if (e === CLIENT_TIMEOUT_ABORT && xhr) {
                xhr.abort('timeout');
                //deferred.reject(xhr, 'timeout');
                return;
            }
            else if (e == SERVER_ABORT && xhr) {
                xhr.abort('server abort');
               // deferred.reject(xhr, 'error', 'server abort');
                return;
            }

            /*if (!doc || doc.location.href == s.iframeSrc) {
                // response not received yet
                if (!timedOut) {
                    return;
                }
            }*/
            if ($io.detachEvent) {
                $io.detachEvent('onload', cb);
            }
            else {
                $io.removeEventListener('load', cb, false);
            }

            var status = 'success', errMsg;
            try {
                if (timedOut) {
                    throw 'timeout';
                }

                var isXml = options.dataType == 'xml' || doc.XMLDocument || isXML(doc);
                log('isXml='+isXml);
                if (!isXml && window.opera && (doc.body === null || !doc.body.innerHTML)) {
                    if (--domCheckCount) {
                        // in some browsers (Opera) the iframe DOM is not always traversable when
                        // the onload callback fires, so we loop a bit to accommodate
                        log('requeing onLoad callback, DOM not available');
                        setTimeout(cb, 250);
                        return;
                    }
                    // let this fall through because server response could be an empty document
                    //log('Could not access iframe DOM after mutiple tries.');
                    //throw 'DOMException: not available';
                }

                log('response detected');
                var docRoot = doc.body ? doc.body : doc.documentElement;
                xhr.responseText = docRoot ? docRoot.innerHTML : null;
                xhr.responseXML = doc.XMLDocument ? doc.XMLDocument : doc;
                if (isXml) {
                    options.dataType = 'xml';
                }
                xhr.getResponseHeader = function(header){
                    var headers = {'content-type': options.dataType};
                    return headers[header.toLowerCase()];
                };
                // support for XHR 'status' & 'statusText' emulation :
                if (docRoot) {
                    xhr.status = Number( docRoot.getAttribute('status') ) || xhr.status;
                    xhr.statusText = docRoot.getAttribute('statusText') || xhr.statusText;
                }

                var dt = (options.dataType || '').toLowerCase();
                var scr = /(json|script|text)/.test(dt);
                if (scr) {
                    // account for browsers injecting pre around json response
                    var pre = doc.getElementsByTagName('pre')[0];
                    var b = doc.getElementsByTagName('body')[0];
                    if (pre) {
                        xhr.responseText = pre.textContent ? pre.textContent : pre.innerText;
                    }
                    else if (b) {
                        xhr.responseText = b.textContent ? b.textContent : b.innerText;
                    }
                }
                else if (dt == 'xml' && !xhr.responseXML && xhr.responseText) {
                    xhr.responseXML = toXml(xhr.responseText);
                }

                try {
                    httpData(xhr, dt, options);
                }
                catch (err) {
                    status = 'parsererror';
                    xhr.error = errMsg = (err || status);
                }
            }
            catch (err) {
                log('error caught: ',err);
                status = 'error';
                xhr.error = errMsg = (err || status);
            }

            if (xhr.aborted) {
                log('upload aborted');
                status = null;
            }

            if (xhr.status) { // we've set xhr.status
                status = (xhr.status >= 200 && xhr.status < 300 || xhr.status === 304) ? 'success' : 'error';
            }

            // ordering of these callbacks/triggers is odd, but that's how $.ajax does it
            if (status === 'success') {
                if (options.onSuccess) {
                    options.onSuccess.call(options.context, xhr);
                }
            }
            else if (status) {
                if (errMsg === undefined) {
                    errMsg = xhr.statusText;
                }
                if (options.onFailure) {
                    options.onFailure.call(options.context, xhr, status, errMsg);
                }
            }

            if (options.onComplete) {
                options.onComplete.call(options.context, xhr, status);
            }

            callbackProcessed = true;
            if (options.timeout) {
                clearTimeout(timeoutHandle);
            }

            // clean up
            setTimeout(function() {
                $io.remove();
                xhr.responseXML = null;
            }, 100);
        }

        var toXml = function(s, doc) { // use parseXML if available (jQuery 1.5+)
            if (window.ActiveXObject) {
                doc = new ActiveXObject('Microsoft.XMLDOM');
                doc.async = 'false';
                doc.loadXML(s);
            }
            else {
                doc = (new DOMParser()).parseFromString(s, 'text/xml');
            }
            return (doc && doc.documentElement && doc.documentElement.nodeName != 'parsererror') ? doc : null;
        };
        
        var httpData = function( xhr, type, s ) { // mostly lifted from jq1.4.4
            var ct = xhr.getResponseHeader('content-type') || '',
                xml = type === 'xml' || (!type && ct.indexOf('xml') >= 0),
                data = xml ? xhr.responseXML : xhr.responseText;

            if (xml && data.documentElement.nodeName === 'parsererror') {
            	log("parsererror");
            }
            
            /*
            if (s && s.dataFilter) {
                data = s.dataFilter(data, type);
            }*/
            
            if (typeof data === 'string') {
                if (type === 'json' || !type && ct.indexOf('json') >= 0) {
                    xhr.responseJSON = data.evalJSON(true);
                /*} else if (type === "script" || !type && ct.indexOf("javascript") >= 0) {
                    $.globalEval(data);*/
                }
            }
        };

        return {
        	doSubmit : doSubmit,
        	doAbort: xhr.abort
        };
    }
    
    function isXML(elem) {
    	// documentElement is verified for cases where it doesn't yet exist
    	// (such as loading iframes in IE - #4833)
    	var documentElement = elem && (elem.ownerDocument || elem).documentElement;
    	return documentElement ? documentElement.nodeName !== "HTML" : false;
    }
    
    // helper fn for console logging
    function log() {
    	if (!options.debug) {
    		return;
    	}
        var msg = '[FileUpload] ' + Array.prototype.join.call(arguments,'');
        if (window.console && window.console.log) {
            window.console.log(msg);
        }
        else if (window.opera && window.opera.postError) {
            window.opera.postError(msg);
        }
    }
}

