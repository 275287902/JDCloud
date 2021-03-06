<?php
/**
@module jdcloud-gendoc

代码内文档生成器。

对以下关键字会生成标题(同时也生成链接): @fn, @var, @module, @class

对以下关键字会生成锚点（被链接对象）：@alias, @key, @event

使用@see可以引用这些对象。特别的，@see后面可连用多个以","分隔的关键字，如 @see param,mparam 。

用法：

	php gendoc.php mysrc.js -title "API-Reference" > doc.html

文档于utf-8编码，引用css文件style.css。该文件可自行配置。

*/

require("lib/common.php");
require("lib/Parsedown.php");

// ====== config
$defaultOptions = [
	"title" => "API文档",
];

// ====== global
$keys = []; # elem:{type, name, ns/namespace}
$newBlock = false;
$blocks = [];
$options = null; # {title, encoding}

$titleStack = []; # elem: [num, level]

// ====== function
// key={type,name}
function makeKeyword($key)
{
	$ns = 'Global';
	if (preg_match('/^(.*)\.(.*)$/', $key['name'], $ms)) {
		$ns = $ms[1];
	}
	else {
	}
	$key['ns'] = $ns;
	return $key;
}

// REFER TO: https://github.com/erusev/parsedown/wiki/Tutorial:-Create-Extensions
class MyParsedown extends Parsedown
{
	function __construct() {
		$this->BlockTypes['@'][] = 'FormatText';
		//$this->inlineMarkerList .= '@';
		$this->breaksEnabled = true;
	}

	protected function blockFormatText($Line)
	{
		$text = $Line['text'];
		if (! preg_match('/@(\w+)\s+([^(){}? ]+)(.*)/', $text, $ms) )
			return;

		global $newBlock, $keys;
		$class = $ms[1];
		$key = $ms[2];
		$other = $ms[3] ?: "";

		if ($newBlock) {
			global $titleStack;
			$titleStack = [];
			$newBlock = false;
			$keys[] = makeKeyword(["name"=>$key, "type"=>$class]);
			$markup = "<h2 id=\"{$key}\">" . $ms[0] . "</h2>"; // remove '@'
		}
		else {
			if ($class == "see") {
				// @see param
				// @see param,mparam
				$ks = explode(',', $key);
				$key = '';
				foreach ($ks as $k) {
					if (strlen($key) >0)
						$key .= " ";
					$key .= "<a href=\"#{$k}\">{$k}</a>";
				}
			}
			else if ($class == "alias" || $class == "key" || $class == "event" || $class == "fn" || $class == "var") {
				$keys[] = makeKeyword(["name"=>$key, "type"=>$class]);
				$key = "<a id=\"{$key}\">{$key}</a>";
			}
			$markup = "<p class=\"{$class}\"><strong>@{$class} {$key}</strong> {$other}</p>";
		}
		$Block = [
			"markup" => $markup
		];
		return $Block;
	}

	private function getTitleNum($level)
	{
		global $titleStack;
		$titleNum = "1";
		while (! empty($titleStack)) {
			// titleStack: item=[num, level]
			$item = &$titleStack[count($titleStack)-1];
			if ($level > $item[1]) {
				$titleNum = $item[0] . '.1';
				$titleStack[] = [ $titleNum, $level ];
				break;
			}
			else if ($level == $item[1]) {
				$titleNum = preg_replace_callback('/(\d+)$/', function ($ms) {
					return (int)$ms[1] +1;
				}, $item[0]);
				$item[0] = $titleNum;
				break;
			}
			else {
				array_pop($titleStack);
			}
			unset($item);
		}
		unset($item);
		if (empty($titleStack)) {
			$titleStack[] = [ $titleNum, $level ];
		}
		return $titleNum;
	}

    protected function blockHeader($Line)
	{
		$e = parent::blockHeader($Line);
		$text = $e['element']['name'];
		// 注释中的标题降两级，并添加题标数
		if (preg_match('/h(\d+)/', $text, $ms)) {
			$level = (int)$ms[1];
			$titleNum = $this->getTitleNum($level);

			$e['element']['name'] = "h" . ($level + 2);
			$e['element']['text'] = $titleNum . " " . $e['element']['text'];
		}
		return $e;
	}
}

function handleOptionEncoding()
{
	global $options;
	if (@$options['encoding']) {
		foreach (['title'] as $prop) {
			$options[$prop] = iconv($options['encoding'], 'utf-8', $options[$prop]);
		}
	}
}

function outputOneKey($key)
{
	echo "<a href=\"#{$key['name']}\">{$key['name']} ({$key['type']})</a><br>\n";
}

// ====== main

$argv1 = null;
$options = mygetopt(['title:', 'encoding:'], $argv1) + $defaultOptions;
handleOptionEncoding();
foreach ($argv1 as $f) {
	@$str = file_get_contents($f) or die ("*** require input file.\n");
	$pd = new MyParsedown();

	preg_replace_callback('/
		\/\*\*+\s* (@\w+ \s+ .*?) \s*\*+\/
	/xs', function ($ms) {

		global $newBlock, $pd, $blocks;
		$newBlock = true;
		$blocks[] = $pd->text($ms[1]);

	}, $str);
}

$docDate = date('Y-m-d');
echo <<<EOL
<html>
<head>
<meta charset="utf-8">
<title>{$options['title']}</title>
<link rel="stylesheet" href="style.css" />
</head>

<h1>{$options['title']}</h1>
<div>最后更新：$docDate</div>

EOL;

# ---------- module list
$first = true;
foreach ($keys as $key) {
	if ($key['type'] == 'module') {
		if ($first) {
			$first = false;
			echo "<h2>Modules</h2>\n";
			echo "<div>\n";
		}
		outputOneKey($key);
	}
}
if ($first == false) {
	echo "</div><hr>\n";
}

# ---------- keyword list
usort($keys, function ($a, $b) {
	return strcmp($a['name'], $b['name']);
});
echo "<h2>Keywords</h2>\n";
echo "<div>\n";
foreach ($keys as $key) {
	outputOneKey($key);
}
echo "</div><hr>\n";

# ----------- blocks
foreach ($blocks as $s) {
	echo $s;
	echo "<hr>\n";
}

# ------- end tag
echo "<div style=\"text-align:center\">Generated by jdcloud-gendoc @ " . date('c') . "</div>\n";
echo "</html>";
