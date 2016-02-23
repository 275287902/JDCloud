// ====== global {{{
var IsBusy = 0;
var g_args = {}; // {_test, _debug, cordova}
var g_cordova = 0; // the version for the android/ios native cient. 0 means web app.
var g_prevPage;

// 应用内部共享数据
var g_data = {}; // {userInfo}
// 应用配置项
var g_cfg = { logAction: false };

//}}}

// ====== app toolkit {{{
/**
@fn appendParam(url, param)

例:

	var url = "http://xxx/api.php";
	if (a)
		url = appendParam(url, "a=" + a);
	if (b)
		url = appendParam(url, "b=" + b);

*/
function appendParam(url, param)
{
	if (param == null)
		return url;
	return url + (url.indexOf('?')>0? "&": "?") + param;
}

/** @fn isWeixin */
function isWeixin()
{
	return /micromessenger/i.test(navigator.userAgent);
}

/** @fn isIOS */
function isIOS()
{
	return /iPhone|iPad/i.test(navigator.userAgent);
}

/**
@fn loadScript(url)

动态加载一个script. 如果曾经加载过, 可以重用cache.

注意: $.getScript一般不缓存(仅当跨域时才使用Script标签方法加载,这时可用缓存), 自定义方法$.getScriptWithCache与本方法类似.
*/
function loadScript(url, fnOK)
{
	var script= document.createElement('script');
	script.type= 'text/javascript';
	script.src= url;
	script.async = true;
	if (fnOK)
		script.onload = fnOK;
	document.body.appendChild(script);
}

// --------- jquery {{{
/**
@fn getFormParam(jform)

取form中带name属性的控件值, 放入一个对象中, 以便手工调用callSvr.

	jf.submit(function () {
		var ac = jf.attr("action");
		callSvr(ac, fn, getFormParam(jf));
	});
	
 */
function getFormParam(jf)
{
	var param = {};
	jf.find("[name]").each (function () {
		param[$(this).attr("name")] = $(this).val();
	});
	return param;
}

/**
@fn $.getScriptWithCache(url, options?)
*/
$.getScriptWithCache = function(url, options) 
{
	// allow user to set any option except for dataType, cache, and url
	options = $.extend(options || {}, {
		dataType: "script",
		cache: true,
		url: url
	});

	// Use $.ajax() since it is more flexible than $.getScript
	// Return the jqXHR object so we can chain callbacks
	return jQuery.ajax(options);
};

/**
@fn setDateBox(jo, defDateFn?)

设置日期框, 如果输入了非法日期, 自动以指定日期(如未指定, 用当前日期)填充.

	setDateBox($("#txtComeDt"), function () { return genDefVal()[0]; });

 */
function setDateBox(jo, defDateFn)
{
	jo.blur(function () {
		var dt = parseDate(this.value);
		if (dt == null) {
			if (defDateFn)
				dt = defDateFn();
			else
				dt = new Date();
		}
		this.value = dt.format("D");
	});
}

/**
@fn setTimeBox(jo, defTimeFn?)

设置时间框, 如果输入了非法时间, 自动以指定时间(如未指定, 用当前时间)填充.

	setTimeBox($("#txtComeTime"), function () { return genDefVal()[1]; });

 */
function setTimeBox(jo, defTimeFn)
{
	jo.blur(function () {
		var dt = parseTime(this.value);
		if (dt == null) {
			if (defTimeFn)
				dt = defTimeFn();
			else
				dt = new Date();
		}
		this.value = dt.format("HH:MM");
	});
}

/**
@fn waitFor(deferredObj)

用于简化异步编程. 可将不易读的回调方式改写为易读的顺序执行方式.

	var dfd = $.getScript("http://...");
	function onSubmit()
	{
		dfd.then(function () {
			foo();
			bar();
		});
	}

可改写为:

	function onSubmit()
	{
		if (waitFor(dfd)) return;
		foo();
		bar();
	}

*/
function waitFor(dfd)
{
	if (waitFor.caller == null)
		throw "waitFor MUST be called in function!";

	if (dfd.state() == "resolved")
		return false;

	if (!dfd.isset_)
	{
		var caller = waitFor.caller;
		var args = caller.arguments;
		dfd.isset_ = true;
		dfd.then(function () { caller.apply(this, args); });
	}
	return true;
}

//}}}

if (window.console === undefined) {
	window.console = {
		log:function () {}
	}
}
// }}}

// ====== app fw {{{
var E_AUTHFAIL=-1;
var E_NOAUTH=2;

/**
@module MUI

Mobile UI framework

== 单网页应用 ==

- 应用程序以page为基本单位，每个页面的html/js可完全分离。参考CPageManager文档。
- 后台交互, callSvr系列方法

== 登录与退出 ==

框架提供MUI.showLogin/MUI.logout操作. 
调用MUI.tryAutoLogin可以支持自动登录.

== 底部导航 ==

设置id为"footer"的导航, 框架会对此做些设置: 如果当前页面为导航栏中的一项时, 就会自动显示导航栏.
例: 在html中添加底部导航:

	<div id="footer">
		<a href="#home">订单</a></li>
		<a href="#me">我</a>
	</div>

如果要添加其它底部导航，可在page内放置如下部件：

	<div class="ft mui-navbar">
		<a href="#home" class="active">订单</a></li>
		<a href="#me">我</a>
	</div>

注意：mui-navbar与ft类并用后，在点击后不会自动设置active类，请自行添加。

== 图片按需加载 ==

TODO:

对于img标签, 可以将src属性改为data-src, 这样只有在img所在page创建时才加载, 而不是一打开应用就加载:

	<img data-src="../m/images/ui/carwash.png">

== 原生应用支持 ==

使用MUI框架的Web应用支持被安卓/苹果原生应用加载（通过cordova技术）。

设置说明：

- 在Web应用中指定正确的应用程序名appName (参考MUI.setApp方法), 该名字将可在g_args._app变量中查看。
- App加载Web应用时在URL中添加cordova={ver}参数，就可自动加载cordova插件(m/cordova或m/cordova-ios目录下的cordova.js文件)，从而可以调用原生APP功能。
- 在App打包后，将apk包或ipa包其中的cordova.js/cordova_plugins.js/plugins文件或目录拷贝出来，合并到 cordova 或 cordova-ios目录下。
  其中，cordova_plugins.js文件应手工添加所需的插件，并根据应用(g_args._app)及版本(g_args.cordova)设置filter. 可通过 cordova.require("cordova/plugin_list") 查看应用究竟使用了哪些插件。
- 在部署Web应用时，建议所有cordova相关的文件合并成一个文件（通过Webcc打包）

对原生应用的额外增强包括：

- 应用加载完成后，自动隐藏启动画面(SplashScreen)
- ios7以上, 自动为状态栏留出空间. 注意需要在style中定义如下样式:

	#ios7statusbar {
		width:100%;
		height:20px;
		background-color:white;
		position:fixed;
		z-index:10000;
		top: 0;
	}

 */

// ------ CPageManager {{{
/**
@class CPageManager

MUI的基类，提供showPage等操作。

页面管理器提供单网页应用框架（一般称单页面应用/SPA，为与应用内page区分，我称之为单网页应用）。
主要特性：
- 页面路由。异步无刷新页面切换。支持浏览器前进后退操作。
- 基于page的模块化开发。支持页面html片段和js片段。
- 统一对待内部页面和外部页面（同样的方式访问，同样的行为）。开发时推荐用外部页面，发布时可打包常用页面成为内部页面。访问任何页面都是index.html#page1的方式，如果page1已存在则使用（内部页面），不存在则动态加载（如找到fragment/page1.html）
- 页面栈管理。可自行pop掉一些页面控制返回行为。

所有的page的html与js均可以独立开发。
如添加一个订单页，使用外部页面，可以添加一个order.html (html片段):

	<div mui-initfn="initPageOrder" mui-script="order.js">
		...
	</div>

如果使用内部页面，则可以写为：

	<script type="text/html" id="tpl_order">
		<div mui-initfn="initPageOrder" mui-script="order.js">
			...
		</div>
	</script>

该页面的代码可以放在一个单独的文件order.js:

	function initPageOrder() 
	{
		var jpage = $(this);
		jpage.on("pagebeforeshow", onBeforeShow);
		jpage.on("pageshow", onShow);
		jpage.on("pagehide", onHide);
		...
	}

框架提供muiInit/pagecreate/pagebeforeshow/pageshow/pagehide事件。
 */
function CPageManager()
{
	var self = this;
	
/**
@var MUI.activePage
*/
	self.activePage = null;

/**
@var MUI.container

现在为$(document.body)
*/
	self.container = null;

/**
@var MUI.showFirstPage?=true

如果为false, 则必须手工执行 MUI.showPage 来显示第一个页面。
*/
	self.showFirstPage = true;

	var m_jstash; // 页面暂存区; 首次加载页面后可用

	function callInitfn(jo, paramArr)
	{
		var ret = jo.data("mui.init");
		if (ret !== undefined)
			return ret;

		var val = jo.attr("mui-initfn");
		if (val == null)
			return;

		var initfn = null;
		try {
			initfn = eval(val);
		}
		catch (e) {
			app_alert("bad initfn: " + val, "e");
		}

		if (initfn)
		{
			ret = initfn.apply(jo, paramArr) || true;
		}
		jo.data("mui.init", ret);
		return ret;
	}
	
	function showPage_(pageRef)
	{
		// 避免hashchange重复调用
		var fn = arguments.callee;
		if (fn.lastPageRef == pageRef)
			return;
		fn.lastPageRef = pageRef;

		// find in document
		var jpage = self.container.find(pageRef);
		// find in template
		if (jpage.size() > 0)
		{
			changePage(jpage);
			return;
		}

		var pageId = pageRef.substr(1);
		var tplRef = '#tpl_' + pageId;
		var jtpl = $(tplRef);
		if (jtpl.size() > 0) {
			var html = $(tplRef).html();
			loadPage(html, pageId);
		}
		else {
			// TODO: validate / hard-code folder
			var pageFile = 'page/' + pageId + ".html";
			enterWaiting(); // NOTE: leaveWaiting in initPage
			$.ajax(pageFile).then(function (html) {
				loadPage(html, pageId);
			});
		}

		function loadPage(html, pageId)
		{
			// 放入dom中，以便document可以收到pagecreate等事件。
			if (m_jstash == null) {
				m_jstash = $("<div id='muiStash' style='display:none'></div>").appendTo(self.container);
			}
			// 注意：如果html片段中有script, 在append时会同步获取和执行(jquery功能)
			var jpage = $(html);
			jpage.attr("id", pageId).addClass("mui-page").appendTo(m_jstash);

			var enableAni = true; // TODO
			if (enableAni)
				jpage.addClass("slideIn");

			var val = jpage.attr("mui-script");
			if (val != null) {
				val = "page/" + val; // TODO: hardcoded-folder
				loadScript(val, initPage);
			}
			else {
				initPage();
			}

			function initPage()
			{
				callInitfn(jpage);
				jpage.trigger("pagecreate");
				changePage(jpage);
				leaveWaiting();
			}
		}

		function changePage(jpage)
		{
			// TODO: silde in for goback
			if (self.activePage && self.activePage[0] === jpage[0])
				return;
			jpage.trigger("pagebeforeshow");
			jpage.appendTo(self.container);
			var oldPage = self.activePage;
			self.activePage = jpage;
			// TODO: use animationend?
			fixPageSize();
			jpage.trigger("pageshow");
			document.title = jpage.find(".hd h1, .hd h2").text();
			// TODO: destroy??
			if (oldPage)
			{
				oldPage.trigger("pagehide");
				if (oldPage.attr("autoDestroy")) {
					oldPage.appendTo(m_jstash);
				}
			}
		}
	}

	function applyHashChange()
	{
		var pageRef = location.hash || "#home";
		showPage_(pageRef);
	}

	$(window).on('hashchange', applyHashChange);

/**
@fn MUI.showPage(pageId/pageRef)

example:

	MUI.showPage("home");
	MUI.showPage("#orders");

*/
	self.showPage = showPage;
	function showPage(pageRef)
	{
		if (pageRef[0] !== '#')
			pageRef = '#' + pageRef;
		location.hash = pageRef;
	}

	$(window).on('orientationchange', fixPageSize);
	$(window).on('resize'           , fixPageSize);

	function fixPageSize()
	{
		if (self.activePage) {
			var jpage = self.activePage;
			var H = window.innerHeight;
			var hd = jpage.find(">.hd").height() || 0;
			var ft = jpage.find(">.ft").height() || 0;
			jpage.height(H);
			jpage.find(">.bd").innerHeight(H - hd - ft);
		}
	}

// ------ enhanceWithin {{{
/**
@var MUI.m_enhanceFn
*/
	self.m_enhanceFn = {}; // selector => enhanceFn

/**
@fn MUI.enhanceWithin(jparent)
*/
	self.enhanceWithin = enhanceWithin;
	function enhanceWithin(jp)
	{
		$.each(self.m_enhanceFn, function (sel, fn) {
			var jo = jp.find(sel);
			if (jp.is(sel))
				jo = jo.add(jp);
			if (jo.size() == 0)
				return;
			jo.each(function (i, e) {
				var je = $(e);
				var opt = getOptions(je);
				if (opt.enhanced)
					return;
				opt.enhanced = true;
				fn(je);
			});
		});
	}

/**
@fn MUI.getOptions(jo)
*/
	self.getOptions = getOptions;
	function getOptions(jo)
	{
		var opt = jo.data("muiOptions");
		if (opt === undefined) {
			opt = {};
			jo.data("muiOptions", opt);
		}
		return opt;
	}

	$(document).on("pagecreate", function (ev) {
		var jpage = $(ev.target);
		enhanceWithin(jpage);
	});
//}}}

// ------- ui: navbar and footer {{{

	self.m_enhanceFn["#footer"] = enhanceFooter;
	self.m_enhanceFn[".mui-navbar"] = enhanceNavbar;

	function activateElem(jo)
	{
		if (jo.hasClass("active"))
			return;
		jo.parent().find(">*").removeClass("active");
		jo.addClass("active");
	}

	function enhanceNavbar(jo)
	{
		// 如果有ft类，则不自动点击后active (#footer是特例)
		if (jo.hasClass("ft"))
			return;
		jo.find(">*").click(function () {
			activateElem($(this));
		});
	}

	function enhanceFooter(jfooter)
	{
		enhanceNavbar(jfooter);
		jfooter.addClass("ft").addClass("mui-navbar");
		var jnavs = jfooter.find(">a");
		var id2nav = {};
		jnavs.each(function(i, e) {
			var m = e.href.match(/#(\w+)/);
			if (m) {
				id2nav[m[1]] = e;
			}
		});
		$(document).on("pagebeforeshow", function (ev) {
			var jpage = $(ev.target);
			var pageId = jpage.attr("id");
			var e = id2nav[pageId];
			if (e === undefined)
			{
				if (jfooter.parent()[0] !== m_jstash[0])
					jfooter.appendTo(m_jstash);
				return;
			}
			jfooter.appendTo(jpage);
			activateElem($(e));
		});
	}

//}}}
// ------- ui: dialog {{{

	self.m_enhanceFn[".mui-dialog"] = enhanceDialog;

	function enhanceDialog(jo)
	{
		jo.wrap("<div class=\"mui-mask\" style=\"display:none\"></div>");
		jo.parent().click(function (ev) {
			if (this !== ev.target)
				return;
			closeDialog(jo);
		});
	}

/**
@fn MUI.showDialog(jdlg)
*/
	self.showDialog = showDialog;
	function showDialog(jdlg)
	{
		var opt = self.getOptions(jdlg);
		if (opt.initfn) {
			opt.onBeforeShow = opt.initfn.call(jdlg);
			opt.initfn = null;
		}
		if (opt.onBeforeShow)
			onBeforeShow.call(jdlg);
		jdlg.show();
		jdlg.parent().show();
	}

/**
@fn MUI.closeDialog(jdlg, remove=false)
*/
	self.closeDialog = closeDialog;
	function closeDialog(jdlg, remove)
	{
		if (remove) {
			jdlg.parent().remove();
			return;
		}
		jdlg.parent().hide();
	}

/**
@fn MUI.setupDialog(jdlg, initfn)

@return 可以不返回, 或返回一个回调函数beforeShow, 在每次Dialog显示前调用.

使用该函数可设置dialog的初始化回调函数和beforeShow回调.

使用方法:

	MUI.setupDialog(jdlg, function () {
		var jdlg = this;
		jdlg.find("#btnOK").click(btnOK_click);

		function btnOK_click(ev) { }

		function beforeShow() {
			// var jdlg = this;
			var jtxt = jdlg.find("#txt1");
			callSvr("getxxx", function (data) {
				jtxt.val(data);
			});
		}
		return beforeShow;
	});

*/
	self.setupDialog = setupDialog;
	function setupDialog(jdlg, initfn)
	{
		self.getOptions(jdlg).initfn = initfn;
	}

/**
@fn MUI.app_alert(msg, type?=i, fn?, timeoutInterval?)
@alias app_alert
@param type "i"|"e"|"w", default="i"

可自定义对话框，接口如下：
- 对象id为muiAlert, class包含mui-dialog.
- .p-title用于设置标题; .p-msg用于设置提示文字
- 两个按钮 #btnOK, #btnCancel，仅当type=q时显示btnCancel.

app_alert一般会复用对话框 muiAlert, 除非层叠开多个alert, 这时将clone一份用于显示并在关闭后删除。

*/
	window.app_alert = self.app_alert = app_alert;
	function app_alert(msg, type, fn, timeoutInterval)
	{
		type = type || "i";
		var icon = {i: "info", w: "warning", e: "error", q: "question"}[type];
		var s = {i: "提示", w: "警告", e: "出错", q: "确认"}[type];

		var jmsg = $("#muiAlert");
		if (jmsg.size() == 0) {
			var html = '' + 
	'<div id="muiAlert" class="mui-dialog">' + 
	'	<h3 class="hd p-title"></h3>' + 
	'	<div class="sp p-msg"></div>' +
	'	<div class="sp">' +
	'		<a href="javascript:;" id="btnOK" class="mui-btn primary">确定</a>' +
	'		<a href="javascript:;" id="btnCancel" class="mui-btn">取消</a>' +
	'	</div>' +
	'</div>'
			jmsg = $(html);
			self.enhanceWithin(jmsg);
			jmsg.parent().appendTo(self.container);
		}

		var isClone = false;
		// 如果正在显示，则使用clone
		if (jmsg.parent().is(":visible")) {
			var jo = jmsg.parent().clone().appendTo(self.container);
			jmsg = jo.find(".mui-dialog");
			isClone = true;
		}
		var opt = self.getOptions(jmsg);
		opt.fn = fn;
		var rand = Math.random();
		opt.rand_ = rand;
		if (! opt.inited) {
			jmsg.find("#btnOK, #btnCancel").click(function () {
				if (opt.fn && this.id == "btnOK") {
					opt.fn();
				}
				opt.rand_ = 0;
				self.closeDialog(jmsg, isClone);
			});
			opt.inited = true;
		}

		jmsg.find("#btnCancel").toggle(type == "q");
		jmsg.find(".p-title").html(s);
		jmsg.find(".p-msg").html(msg);
		self.showDialog(jmsg);

		if (timeoutInterval != null) {
			setTimeout(function() {
				// 表示上次显示已结束
				if (rand == opt.rand_)
					jmsg.find("#btnOK").click();
			}, timeoutInterval);
		}
	}

//}}}

// ------ main
	
	function main()
	{
		self.container = $(document.body);
		enhanceWithin(self.container);

		// 在muiInit事件中可以调用showPage.
		self.container.trigger("muiInit");

		// 根据hash进入首页
		if (self.showFirstPage)
			applyHashChange();
	}

	$(main);
}
//}}}

// ------ CComManager {{{
/**
@class CComManager
@param app IApp={appName?=user}

提供callSvr等与后台交互的API.

*/
function CComManager(app)
{
	var self = this;

/**
@var MUI.lastError = ctx

ctx: {ac, tm, tv, ret}

- ac: action
- tm: start time
- tv: time interval
- ret: return value
*/
	self.lastError = null;
	var m_app = app;
	var m_tmBusy;
	var m_manualBusy = 0;
	var m_jLoader;

/**
@fn app_abort()

中止之后的调用, 直接返回.
*/
	window.app_abort = app_abort;
	function app_abort()
	{
		throw("abort");
	}

/**
@fn MUI.setOnError()

一般框架自动设置onerror函数；如果onerror被其它库改写，应再次调用该函数。
allow throw("abort") as abort behavior.
 */
	self.setOnError = setOnError;
	function setOnError()
	{
		var fn = window.onerror;
		window.onerror = function (msg) {
			if (fn && fn.apply(this, arguments) === true)
				return true;
			if (/abort$/.test(msg))
				return true;
			debugger;
		}
	}
	setOnError();

	$.ajaxSetup({
		//dataType: "text",
		dataFilter: function (data, type) {
			if (type == "text") {
				rv = defDataProc.call(this, data);
				if (rv != null)
					return rv;
				-- $.active; // ajax调用中断,这里应做些清理
				app_abort();
			}
			return data;
		},

		error: defAjaxErrProc
	});

	// $(document).on("pageshow", function () {
	// 	if (IsBusy)
	// 		$.mobile.loading("show");
	// });

	/**
	@fn delayDo(fn, delayCnt?=3)

	设置延迟执行。当delayCnt=1时与setTimeout效果相同。
	多次置于事件队列最后，一般3次后其它js均已执行完毕，为idle状态
	*/
	window.delayDo = delayDo;
	function delayDo(fn, delayCnt)
	{
		if (delayCnt == null)
			delayCnt = 3;
		doIt();
		function doIt()
		{
			if (delayCnt == 0)
			{
				fn();
				return;
			}
			-- delayCnt;
			setTimeout(doIt);
		}
	}

/**
@fn MUI.enterWaiting(ctx?)
@param ctx {ac, tm, tv?, tv2?, noLoadingImg?}
@alias enterWaiting()
*/
	window.enterWaiting = self.enterWaiting = enterWaiting;
	function enterWaiting(ctx)
	{
		if (IsBusy == 0) {
			m_tmBusy = new Date();
		}
		IsBusy = 1;
		if (ctx == null)
			++ m_manualBusy;
		// 延迟执行以防止在page show时被自动隐藏
		//delayDo(function () {
			if (!(ctx && ctx.noLoadingImg))
				showLoading();
	// 		if ($.mobile && !(ctx && ctx.noLoadingImg))
	// 			$.mobile.loading("show");
		//},1);
	}

/**
@fn MUI.leaveWaiting(ctx?)
@alias leaveWaiting
*/
	window.leaveWaiting = self.leaveWaiting = leaveWaiting;
	function leaveWaiting(ctx)
	{
		if (ctx == null)
		{
			if (-- m_manualBusy < 0)
				m_manualBusy = 0;
		}
		// 当无远程API调用或js调用时, 设置IsBusy=0
		delayDo(function () {
			if (g_cfg.logAction && ctx && ctx.ac && ctx.tv) {
				var tv2 = (new Date() - ctx.tm) - ctx.tv;
				ctx.tv2 = tv2;
				console.log(ctx);
			}
			if ($.active == 0 && IsBusy && m_manualBusy == 0) {
				IsBusy = 0;
				var tv = new Date() - m_tmBusy;
				m_tmBusy = 0;
				console.log("idle after " + tv + "ms");

				// handle idle
				hideLoading();
	// 			if ($.mobile)
	// 				$.mobile.loading("hide");
			}
		});
	}

	function defAjaxErrProc(xhr, textStatus, e)
	{
		if (xhr && xhr.status != 200) {
			if (xhr.status == 0) {
				app_alert("连不上服务器了，是不是网络连接不给力？", "e");
			}
			else {
				app_alert("操作失败: 服务器错误. status=" + xhr.status + "-" + xhr.statusText, "e");
			}
			var ctx = this._ctx || {};
			leaveWaiting(ctx);
		}
	}

	// return: ==null: 做出错处理，不调用回调函数。
	// 注意：服务端不应返回null, 否则客户回调无法执行; 习惯上返回false表示让回调处理错误。
	function defDataProc(rv)
	{
		var ctx = this.ctx_ || {};
		try {
			rv = $.parseJSON(rv);
		}
		catch (e)
		{
			leaveWaiting(ctx);
			app_alert("服务器通讯异常: " + e);
			return;
		}

		if (ctx.tm) {
			ctx.tv = new Date() - ctx.tm;
		}
		ctx.ret = rv;

		leaveWaiting(ctx);
		if (rv && $.isArray(rv) && rv.length >= 2 && typeof rv[0] == "number") {
			if (rv[0] == 0)
				return rv[1];

			if (this.noex)
			{
				self.lastError = ctx;
				return false;
			}

			if (rv[0] == E_NOAUTH) {
				popPageStack(0);
				showLogin();
				return;
			}
			else if (rv[0] == E_AUTHFAIL) {
				app_alert("验证失败，请检查输入是否正确!", "e");
				return;
			}
			logError();
			app_alert("操作失败：" + rv[1], "e");
		}
		else {
			logError();
			app_alert("服务器通讯协议异常!", "e"); // 格式不对
		}

		function logError()
		{
			self.lastError = ctx;
			console.log("failed call");
			console.log(ctx);
		}
	}

/**
@fn MUI.makeUrl(action, params)
@alias makeUrl

生成对后端调用的url. 

	var params = {id: 100};
	var url = makeUrl("Ordr.set", params);

注意：调用该函数生成的url在结尾有标志字符串"zz=1", 如"../api.php/login?_app=user&zz=1"
 */
	window.makeUrl = self.makeUrl = makeUrl;
	function makeUrl(action, params)
	{
		// 避免重复调用
		if (action.indexOf("zz=1") >0)
			return action;

		if (params == null)
			params = {};
		var url;
		if (action.indexOf(".php") < 0)
		{
			var usePathInfo = true;
			if (usePathInfo) {
				url = "../api.php/" + action;
			}
			else {
				url = "../api.php";
				params.ac = action;
			}
		}
		else {
			url = action;
		}
		if (g_cordova)
			params._ver = "a/" + g_cordova;
		if (m_app.appName)
			params._app = m_app.appName;
		if (g_args._test)
			params._test = 1;
		if (g_args._debug)
			params._debug = g_args._debug;
		params.zz = 1; // zz标记
		return appendParam(url, $.param(params)); // appendParam(url, params);
	}

/**
@fn MUI.callSvr(ac, param?, fn?, data?, userOptions?)
@fn MUI.callSvr(ac, fn?, data?, userOptions?)
@alias callSvr

@param ac String. action, 交互接口名. 也可以是URL(比如由makeUrl生成)
@param param Object. URL参数（或称HTTP GET参数）
@param data Object. POST参数. 如果有该参数, 则自动使用HTTP POST请求(data作为POST内容), 否则使用HTTP GET请求.
@param fn Function(data). 回调函数, data参考该接口的返回值定义。
@param userOptions 用户自定义参数, 会合并到$.ajax调用的options参数中.可在回调函数中用"this.参数名"引用. 

常用userOptions: 
- 指定{async:0}来做同步请求, 一般直接用callSvrSync调用来替代.
- 指定{noex:1}用于忽略错误处理, 当后端返回错误时, 回调函数会被调用, 且参数data=false.
- 指定{noLoadingImg:1}用于忽略loading图标.

例：

	callSvr("logout");
	callSvr("logout", api_logout);
	callSvr("login", {wantAll:1}, api_login);
	callSvr("info/hotline.php", {q: '大众'}, api_hotline);

	// 也兼容使用makeUrl的旧格式如:
	callSvr(makeUrl("logout"), api_logout);
	callSvr(makeUrl("logout", {a:1}), api_logout);

	callSvr("User.get", function (data) {
		if (data === false) { // 仅当设置noex且服务端返回错误时可返回false
			return;
		}
		foo(data);
	}, null, {noex:1});

框架会自动在ajaxOption中增加ctx_属性，它包含 {ac, tm, tv, tv2, ret} 这些信息。
当设置g_cfg.logAction=1时，将输出这些信息。
- ac: action
- tm: start time
- tv: time interval (从发起请求到服务器返回数据完成的时间, 单位是毫秒)
- tv2: 从接到数据到完成处理的时间，毫秒(当并发处理多个调用时可能不精确)
*/
	window.callSvr = self.callSvr = callSvr;
	function callSvr(ac, params, fn, data, userOptions)
	{
		if (params instanceof Function) {
			// 兼容格式：callSvr(url, fn?, data?, userOptions?);
			userOptions = data;
			data = fn;
			fn = params;
			params = null;
		}
		var url = makeUrl(ac, params);
		var ctx = {ac: ac, tm: new Date()};
		if (userOptions && userOptions.noLoadingImg)
			ctx.noLoadingImg = 1;
		enterWaiting(ctx);
		var method = (data == null? 'GET': 'POST');
		var options = $.extend({
			dataType: 'text',
			url: url,
			data: data,
			type: method,
			success: fn,
			ctx_: ctx
		}, userOptions);
		console.log("call " + ac);
		return $.ajax(options);
	}

/**
@fn MUI.callSvrSync(ac, params?, fn?, data?, userOptions?)
@fn MUI.callSvrSync(ac, fn?, data?, userOptions?)
@alias callSvrSync

同步模式调用callSvr.
*/
	window.callSvrSync = self.callSvrSync = callSvrSync;
	function callSvrSync(ac, params, fn, data, userOptions)
	{
		var ret;
		if (params instanceof Function) {
			userOptions = data;
			data = fn;
			fn = params;
			params = null;
		}
		userOptions = $.extend({async: false}, userOptions);
		var dfd = callSvr(ac, params, fn, data, userOptions);
		dfd.then(function(data) {
			ret = data;
		});
		return ret;
	}

/**
@fn MUI.setupCallSvrViaForm($form, $iframe, url, fn, callOpt)

@param $iframe 一个隐藏的iframe组件.
@param callOpt 用户自定义参数. 参考callSvr的同名参数. e.g. {noex: 1}

一般对后端的调用都使用callSvr函数, 但像上传图片等操作不方便使用ajax调用, 因为要自行拼装multipart/form-data格式的请求数据. 
这种情况下可以使用form的提交和一个隐藏的iframe来实现类似的调用.

先定义一个form, 在其中放置文件上传控件和一个隐藏的iframe. form的target属性设置为iframe的名字:

	<form data-role="content" action="upload" method=post enctype="multipart/form-data" target="ifrUpload">
		<input type=file name="file[]" multiple accept="image/*">
		<input type=submit value="上传">
		<iframe id='ifrUpload' name='ifrUpload' style="display:none"></iframe>
	</form>

然后就像调用callSvr函数一样调用setupCallSvrViaForm:

	var url = makeUrl("upload", {genThumb: 1});
	MUI.setupCallSvrViaForm($frm, $frm.find("iframe"), url, onUploadComplete);
	function onUploadComplete(data) 
	{
		alert("上传成功");
	}

 */
	self.setupCallSvrViaForm = setupCallSvrViaForm;
	function setupCallSvrViaForm($form, $iframe, url, fn, callOpt)
	{
		$form.attr("action", url);

		$iframe.on("load", function () {
			var data = this.contentDocument.body.innerText;
			if (data == "")
				return;
			var rv = defDataProc.call(callOpt, data);
			if (rv == null)
				app_abort();
			fn(rv);
		});
	}

/**
@fn MUI.showLoading()
*/
	self.showLoading = showLoading;
	function showLoading()
	{
		if (m_jLoader == null) {
			m_jLoader = $("<div class='mui-loader'></div>");
		}
		m_jLoader.appendTo(document.body);
	}
	
/**
@fn MUI.hideLoading()
*/
	self.hideLoading = hideLoading;
	function hideLoading()
	{
		if (m_jLoader)
			m_jLoader.remove();
	}
}
//}}}

// ------ MUI {{{
var MUI = new nsMUI();
function nsMUI()
{
	var self = this;

/**
@var MUI.m_app

参考MUI.setApp
*/
	self.m_app = {
		appName: "user",
		allowedEntries: [],
		loginPage: "#login",
	};

	CPageManager.call(this);
	CComManager.call(this, self.m_app);

	var m_onLoginOK;

// ------ jquery mobile {{{

// ---- 通用事件 {{{
function document_pageCreate(ev)
{
	var jpage = $(ev.target);

	var jhdr = jpage.find("> .hd");
	// 标题栏空白处点击5次, 进入测试模式
	jhdr.click(function (ev) {
		// 注意避免子元素bubble导致的事件
		if ($(ev.target).hasClass("hd"))
			switchTestMode(this); 
	});
}

function document_popupShow(ev)
{
	var jdlg = $(ev.target);
	if (jdlg.data("picLoaded_"))
		return;
	jdlg.data("picLoaded_", true);
	// 图片按需加载
	jdlg.find("img[data-src]").each(function () {
		this.src = $(this).data("src");
	});
}

$(document).on("pagecreate", document_pageCreate);
$(document).on("popupbeforeposition", document_popupShow);
//}}}

// ---- 处理浏览器前进后退 {{{
// 注: 以下私有属性暴露出去是为了在控制台中更方便查看.
/**
@var MUI.m_pageStack
当前页面栈. 当浏览器前进后退(或调用history.back()之类方法)时, 会相应调整.
*/
self.m_pageStack = [""];

/**
@var MUI.m_SP
当前页面栈指针
*/
self.m_SP = 0;

/**
@var MUI.m_disablePageStack?=false
如果配置为true, 可比较禁用页面栈之后的效果.
*/
self.m_disablePageStack=false;

function getPageId(page)
{
	if (page == null)
		return null;
	if (page.attr)
		return page.attr("id");
	var ms = page.match(/#(\w+)$/);
	if (ms != null)
		return ms[1];
	return "";
}

/** 
@fn MUI.popPageStack(n?=1) 

离开页面时, 如果不希望在点击后退按钮后回到该页面, 可以调用

	MUI.popPageStack()

如果要在后退时忽略两个页面, 可以调用

	MUI.popPageStack(2)

如果要在后退时直接回到主页(忽略所有历史记录), 可以调用

	MUI.popPageStack(0)

*/
self.popPageStack = popPageStack;
// n?=1. n=0: 退到首层, >0: 指定pop几层
function popPageStack(n)
{
	if (n == null)
		n = 1;

	if (n == 0) {
		self.m_pageStack.splice(1);
		self.m_SP = 0;
	}
	else if (n > 0) {
		self.m_SP -= n;
		if (self.m_SP < 0)
			self.m_SP = 0;
		self.m_pageStack.splice(self.m_SP+1, n);
	}
}

function handleGoBack()
{
	//$.mobile.pageContainer.on("pagecontainerbeforechange", pageContainer_beforeChange);

	var lastFrom, lastTo;
	function pageContainer_beforeChange(ev, ui) 
	{
		if (ui.options.role == "popup")
			return;

		// 防止调用多次
		var toPageId = getPageId(ui.toPage);
		var fromPageId = getPageId(ui.prevPage);

		if (lastFrom == fromPageId || lastTo == toPageId)
			return;
		lastFrom = fromPageId;
		lastTo = toPageId;

		// console.log("----before change-----");
		g_prevPage = ui.prevPage;
// 		console.log(ui.prevPage);
// 		console.log(ui.toPage);

		var ret = true;
		var pageStack = self.m_pageStack;

		if (ui.options.fromHashChange && ui.options.direction && !self.m_disablePageStack) { // direction判断是点击了 后退/前进 按钮
			var found = false;
			var i;
			// !!! 注意: ui.options.direction == "back"/"forward" 并不可靠, 有时点forward会当back处理, 所以不要用

			for (i=self.m_SP; i<pageStack.length; ++i) {
				if (toPageId == pageStack[i])
				{
					found = true;
					break;
					//return false;
				}
			}
			if (!found) {
				for (i=self.m_SP; i>=0; --i) {
					if (toPageId == pageStack[i])
					{
						found = true;
						break;
					}
				}
			}

			if (!found || self.m_SP == i) { // 如果回退页面和当前页面相同, 再回退一次
				// 遇到已删除的历史, 当回退处理
				if (self.m_SP > 0) {
					-- self.m_SP;
				}
				location.replace("#" + pageStack[self.m_SP]);//按了返回键: 当前的前一个页面
				//history.replaceState(null, null, "#" + pageStack[self.m_SP]);

				// 取消之后的动作
				return false;
			}
			self.m_SP = i;
			return;
		}

		if (pageStack.length == 0 || pageStack[self.m_SP] != toPageId)
		{
			++ self.m_SP;
			pageStack.splice(self.m_SP, pageStack.length, toPageId);
		}
		return ret;
	}
}
//}}}

// ---- 处理ios7以上标题栏问题(应下移以空出状态栏)
// 需要定义css: #ios7statusbar
function handleIos7Statusbar()
{
	if(g_cordova){
		var ms = navigator.userAgent.match(/(iPad.*|iPhone.*|iPod.*);.*CPU.*OS (\d+)_\d/i);
		if(ms) {
			var ver = ms[2];
			if (ver >= 7)
				$("body").addClass("ios7").append("<div id='ios7statusbar'>");;
		}	
	}
}

//}}}

/**
@fn MUI.setFormSubmit(jf, fn?, opt?={rules, validate})
@param fn? the callback for callSvr. you can use this["userPost"] to retrieve the post param.

opt.rules: 参考jquery.validate文档
opt.validate: Function(jf). 如果返回false, 则取消submit.

*/
self.setFormSubmit = setFormSubmit;
function setFormSubmit(jf, fn, opt)
{
	opt = opt || {};
	jf.submit(function () {
		if (opt.validate) {
			if (false === opt.validate(jf))
				return false;
		}
		var ac = jf.attr("action");
		var params = getFormParam(jf);
		callSvr(ac, fn, params, {userPost: params});
		return false;
	});
}

/**
@fn MUI.showValidateErr(jvld, jo, msg)

TODO: remove
show error using jquery validator's method by jo's name
*/
self.showValidateErr = showValidateErr;
function showValidateErr(jvld, jo, msg)
{
	var opt = {};
	opt[jo.attr("name")] = msg;
	jvld.showErrors(opt);
	jo.focus();
}

//}}}

// ------ cordova setup {{{
$(document).on("deviceready", function () {
	// TODO: hardcode "home"
	// 在home页按返回键退出应用。
	$(document).on("backbutton", function () {
		if ($.mobile.activePage.attr("id") == "home") {
			if (! confirm("退出应用?"))
				return;
			navigator.app.exitApp();
			return;
		}
		$.mobile.back();
	});

	$(document).on("menubutton", function () {
	});

	if (navigator.splashscreen && navigator.splashscreen.hide)
	{
		// 成功加载后稍等一会(避免闪烁)后隐藏启动图
		$(function () {
			setTimeout(function () {
				navigator.splashscreen.hide();
			}, 500);
		});
	}
});

//}}}

// ------ enter and exit {{{
/**
@fn MUI.showLogin(jpage?)
@param jpage 如果指定, 则登录成功后转向该页面; 否则转向登录前所在的页面.

显示登录页. 注意: 登录页地址通过setApp({loginPage})指定, 缺省为"#login".

	<div data-role="page" id="login">
	...
	</div>

*/
self.showLogin = showLogin;
function showLogin(jpage)
{
	var jcurPage = jpage || MUI.activePage;
	// back to this page after login
	if (jcurPage) {
		m_onLoginOK = function () {
			MUI.showPage("#" + jcurPage.attr("id"));
		}
		MUI.showPage(self.m_app.loginPage);
	}
	else {
		// only before jquery mobile inits
		// back to this page after login:
		var pageHash = location.hash || "#";
		m_onLoginOK = function () {
			MUI.showPage(pageHash);
		}
	}
	MUI.showPage(self.m_app.loginPage);
}

/**
@fn MUI.logout(dontReload?)
@param dontReload 如果非0, 则注销后不刷新页面.

注销当前登录, 成功后刷新页面(除非指定dontReload=1)
*/
self.logout = logout;
function logout(dontReload)
{
	deleteLoginToken();
	g_data.userInfo = null;
	callSvr("logout", function () {
		if (! dontReload)
			reloadSite();
	});
}

// check if the entry is in the entry list. if not, refresh the page without search query (?xx) or hash (#xx)
function validateEntry(allowedEntries)
{
	if (allowedEntries == null)
		return;

	if (/*location.search != "" || */
			(location.hash && location.hash != "#" && allowedEntries.indexOf(location.hash) < 0) ) {
		location.href = location.pathname + location.search;
		app_abort();
	}
}

// set g_args
function parseArgs()
{
	if (location.search)
		g_args = parseQuery(location.search.substr(1));

	if (g_args.test || g_args._test) {
		g_args._test = 1;
		alert("测试模式!");
	}

	if (g_args.cordova || getStorage("cordova")) {
		if (g_args.cordova === 0) {
			delStorage("cordova");
		}
		else {
			g_cordova = parseInt(g_args.cordova || getStorage("cordova"));
			g_args.cordova = g_cordova;
			setStorage("cordova", g_cordova);
			$(function () {
				// to use cordova plugins like camera: require m2/cordova.js, cordova_plugins.js, plugins/...
				if (isIOS()) {
					loadScript("cordova-ios/cordova.js?__HASH__,m"); 
				}
				else {
					loadScript("cordova/cordova.js?__HASH__,m"); 
				}
			});
		}
	}
}
parseArgs();

// ---- login token for auto login {{{
function tokenName()
{
	var name = "token";
	if (self.m_app.appName)
		name += "_" + self.m_app.appName;
	if (g_args._test)
		name += "_test";
	return name;
}

function saveLoginToken(data)
{
	if (data._token)
	{
		setStorage(tokenName(), data._token);
	}
}

function loadLoginToken()
{
	return getStorage(tokenName());
}

function deleteLoginToken()
{
	delStorage(tokenName());
}

/**
@fn MUI.tryAutoLogin(onHandleLogin, reuseCmd?, allowNoLogin?=false)

尝试自动登录，如果失败则转到登录页（除非allowNoLogin=true）。

@param onHandleLogin Function(data). 调用后台login()成功后的回调函数(里面使用this为ajax options); 可以直接使用MUI.handleLogin
@param reuseCmd String. 当session存在时替代后台login()操作的API, 如"User.get", "Employee.get"等, 它们在已登录时返回与login相兼容的数据. 因为login操作比较重, 使用它们可减轻服务器压力. 
@param allowNoLogin Boolean. 缺省未登录时会自动跳转登录页面, 如果设置为true, 如不会自动跳转登录框, 表示该应用允许未登录时使用.

该函数应该在muiInit事件中执行, 以避免框架页面打开主页。

	$(document).on("muiInit", myInit);

	function myInit()
	{
		// redirect to login if auto login fails
		MUI.tryAutoLogin(handleLogin, "User.get");
	}

	function handleLogin(data)
	{
		MUI.handleLogin(data);
		// g_data.userInfo已赋值
	}

*/
self.tryAutoLogin = tryAutoLogin;
function tryAutoLogin(onHandleLogin, reuseCmd, allowNoLogin)
{
	var ok = false;
	var ajaxOpt = {async: false, noex: true};

	function handleAutoLogin(data)
	{
		if (data === false) // has exception (as noex=true)
			return;
		if (onHandleLogin)
			onHandleLogin.call(this, data);
		ok = true;
	}

	// first try "User.get"
	if (reuseCmd != null) {
		callSvr(reuseCmd, handleAutoLogin, null, ajaxOpt);
	}
	if (ok)
		return;

	// then use "login(token)"
	var token = loadLoginToken();
	if (token != null)
	{
		var param = {wantAll:1};
		var postData = {token: token};
		callSvr("login", param, handleAutoLogin, postData, ajaxOpt);
	}
	if (ok)
		return;

	if (! allowNoLogin)
	{
		self.showFirstPage = false;
		showLogin();
	}
}

/**
@fn MUI.handleLogin(data)
@param data 调用API "login"成功后的返回数据.

处理login相关的操作, 如设置g_data.userInfo, 保存自动登录的token等等.

*/
self.handleLogin = handleLogin;
function handleLogin(data)
{
	saveLoginToken(data);
	g_data.userInfo = data;
	if (m_onLoginOK) {
		var fn = m_onLoginOK;
		m_onLoginOK = null;
		setTimeout(fn);
	}
	else {
		// 转主页 TODO: home
		self.showPage("#home");
	}
}
//}}}

//}}}

// ------ main {{{

// 单击5次，每次间隔不大于2s
function switchTestMode(obj)
{
	var INTERVAL = 4; // 2s
	var MAX_CNT = 5;
	var f = switchTestMode;
	var tm = new Date();
	// init, or reset if interval 
	if (f.cnt == null || f.lastTm == null || tm - f.lastTm > INTERVAL*1000 || f.lastObj != obj)
	{
		f.cnt = 0;
		f.lastTm = tm;
		f.lastObj = obj;
	}
//	console.log("switch: " + f.cnt);
	if (++ f.cnt >= MAX_CNT) {
		f.cnt = 0;
		f.lastTm = tm;
		var url = prompt("切换URL?", location.href);
		if (url == null || url == location.href)
			return;
		if (url[0] == "/") {
			url = "http://" + url;
		}
		location.href = url;
		app_abort();
	}
}

function main()
{
	/*
	handleGoBack();
	handleIos7Statusbar();
	*/
}

$(main);
//}}}

/**
@fn MUI.setApp(app)

@param app={appName?=user, allowedEntries?, loginPage?="#login"}

- appName: 用于与后端通讯时标识app.
- allowedEntries: 一个数组, 如果初始页面不在该数组中, 则自动转向主页.
- loginPage: login页面的地址, 默认为"#login"
*/
self.setApp = setApp;
function setApp(app)
{
	$.extend(self.m_app, app);
	g_args._app = app.appName;

	if (app.allowedEntries)
		validateEntry(app.allowedEntries);
}

}
//}}}

//}}}

// vim: set foldmethod=marker: