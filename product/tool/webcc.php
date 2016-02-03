<?php

//====== global {{{
$opts = [
"srcDir" => null,
"outDir" => "output_web"
];

$g_handledFiles = []; // elem: $file => 1
$g_hash = []; // elem: $file => $hash

$COPY_EXCLUDE = [];

// ���û������� DBG_LEVEL=1 ��ʾ������Ϣ
$DBG_LEVEL = (int)getenv("P_DEBUG") ?: 0;
//}}}

// ====== functions {{{
function logit($s, $level=1)
{
	global $DBG_LEVEL;
	if ($DBG_LEVEL >= $level)
		echo $s;
}

// ����ǰ·������PATH, ���ڵ���ͬĿ¼�ĳ�����jsmin
function addPath()
{
	global $argv;
	$path = realpath(dirname($argv[0]));
	putenv("PATH=" . $path . PATH_SEPARATOR . getenv("PATH"));
}

// "xx\yy" => "xx/yy"
// "xx/zz/../yy" => "xx/yy"
function formatPath($f)
{
	$f = preg_replace('/[\\\\\/]+/', '/', $f);
	$f = preg_replace('`[^/]+/\.\./`', '', $f);
	return $f;
}

function getFileHash($basef, $f, $outDir, $relativeDir = null)
{
	global $g_hash;
	global $g_handledFiles;
	if ($relativeDir == null) {
		$relativeDir = dirname($basef);
	}
	$f0 = formatPath($relativeDir . "/$f");
	$f1 = $outDir . "/" . $f0;
	$f2 = realpath($f1);
	if ($f2 === false || !array_key_exists($f0, $g_handledFiles))
		handleOne($f0, $outDir, true);
	$f2 = realpath($f1);
	if ($f2 === false)
		die("*** fail to find file `$f` base on `$basef` ($f2)\n");
	@$hash = $g_hash[$f2];
	if ($hash == null) {
		$hash = sha1_file($f2);
		$g_hash[$f2] = $hash;
// 		echo("### hash {$f2}\n");
	}
	else {
// 		echo("### reuse hash({$f2})\n");
	}
	return substr($hash, -6);
}

// <script src="main.js?__HASH__"></script>
// loadScript("cordova/cordova.js?__HASH__,m2)");  -> m2/cordova/cordova.js
// ���inputFile�ǿգ�ֱ�Ӷ�ȡ��; ���Ϊnull, ����$f��Ϊ���롣
function handleHash($f, $outDir, $inputFile = null)
{
	if ($inputFile == null)
		$inputFile = $f;
	$s = file_get_contents($inputFile);

	if (preg_match('/\.html/', $f)) {
		$s = preg_replace_callback('/
			^.*WEBCC_BEGIN.*$ 
			(?:.|\n)*?
			(?:^.*WEBCC_USE_THIS.*$[\r\n]*
				((?:.|\n)*?)
			)?
			^.*WEBCC_END.*$[\r\n]*
		/xm', 
		function ($ms) {
			return $ms[1] ?: "";
		}, $s);
	}

	$s = preg_replace_callback('/"([^"]+)\?__HASH__(?:,([^"]+))?"/',
	function ($ms) use ($f, $outDir) {
		$relativeDir = @$ms[2];
		$hash = getFileHash($f, $ms[1], $outDir, $relativeDir);
		return '"' . $ms[1] . '?v=' . $hash . '"';
	}, $s);

	$outf = $outDir . "/" . $f;
	@mkdir(dirname($outf), 0777, true);
// 	echo("=== hash $f\n");
	file_put_contents($outf, $s);
}

function handleCopy($f, $outDir)
{
	$outf = $outDir . "/" . $f;
	@mkdir(dirname($outf), 0777, true);
//	echo("=== copy $f\n");
	copy($f, $outf);
}

function handleOne($f, $outDir, $force = false)
{
	global $FILES;
	global $RULES;
	global $COPY_EXCLUDE;
	global $g_handledFiles;

	// $FILES����һ�����ڵ��� �����ļ�
	if (!$force && isset($FILES)) {
		$skip = true;
		foreach ($FILES as $re) {
			if (fnmatch($re, $f)) {
				$skip = false;
				break;
			}
		}
		if ($skip)
			return;
	}

	$g_handledFiles[formatPath($f)] = 1;

	$rule = null;
	foreach ($RULES as $re => $v) {
		if (fnmatch($re, $f)) {
			$rule = $v;
			break;
		}
	}
	if (isset($rule))
	{
		logit("=== rule $re on $f\n");
		if (! is_array($rule)) {
			$rule = [ $rule ];
		}
		$outf = null;
		foreach ($rule as $rule1) {
			if ($rule1 === "HASH") {
				logit("=== hash $f\n");
				handleHash($f, $outDir, $outf);
			}
			else {
				$outf = $outDir . "/" . $f;
				@mkdir(dirname($outf), 0777, true);
				putenv("TARGET={$outf}");
				// system($rule1);
				file_put_contents("tmp.sh", $rule1);
				passthru("sh tmp.sh");
			}
		}
		return;
	}

	$noCopy = false;
	foreach ($COPY_EXCLUDE as $re) {
		if (fnmatch($re, $f)) {
			$noCopy = true;
			break;
		}
	}
	if ($noCopy)
		return;
	logit("=== copy $f\n");
	handleCopy($f, $outDir);
}

//}}}

// ====== main {{{

// ==== parse args {{{
if (count($argv) < 2) {
	echo("Usage: webcc {srcDir} [-o {outDir}] [-rev {gitRevision}]\n");
	exit(1);
}

while ( ($opt = next($argv)) !== false) {
	if ($opt[0] === '-') {
		$opt = substr($opt, 1);

		if ($opt === 'o') {
			$v = next($argv);
			if ($v === false)
				die("*** require value for option `$opt`\n");
			$opts["outDir"] = $v;
		}
		else {
			die("*** unknonw option `$opt`.\n");
		}
		continue;
	}
	$opts["srcDir"] = $opt;
}

if (is_null($opts["srcDir"])) 
	die("*** require param srcDir.");
if (! is_dir($opts["srcDir"]))
	die("*** not a folder: `{$opts["srcDir"]}`\n");

addPath();
// load config
$cfg = $opts["srcDir"] . "/webcc.conf.php";
if (is_file($cfg)) {
	echo("=== load config `$cfg`\n");
	require($cfg);
}

$COPY_EXCLUDE[] = 'webcc.conf.php';
//}}}

@mkdir($opts["outDir"], 0777, true);
$outDir = realpath($opts["outDir"]);

chdir($opts["srcDir"]);
$fp = popen("git ls-files", "r");
while (($s=fgets($fp)) !== false) {
	$f = rtrim($s);
	handleOne($f, $outDir);
}
pclose($fp);

echo("=== output to `$outDir`\n");
//}}}
// vim: set foldmethod=marker :
?>
