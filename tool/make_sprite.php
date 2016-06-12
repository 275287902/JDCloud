<?php

/*
��ͬ�ߴ�Ķ��Сͼ������ƴ�ϳ�һ�Ŵ�ͼƬ, ��������Ӧ��css�����ļ�.

1. ��װimagemagick���, ȷ���������п�������convert������.

2. ����ʱ, ��ͼ�갴��ȷֱ�������Ӧ�ļ�����, �� icon/16/xx.png, icon/24/xx.png, Ȼ�󴴽�css�����ļ�, ������Ϊ icon-src.css, ����:

	.icon-tree {
		background-image: url(icon/24/tree2.png);
	}
	.active .icon-tree {
		background-image: url(icon/24/tree.png);
	}
	.icon-back {
		background-image: url(icon/16/back.png);
	}
	.icon-menu {
		background-image: url(icon/16/menu.png);
	}

3. ʹ�ñ��������ɷ�����css�Լ�ƴ�õĴ�ͼ.
		
�÷�:

	php make_sprite.php icon-src.css icon.css

icon-src.cssΪǰ��һ��������cssͼ�������ļ�. 
���������, ���� icon/24/sprite.png, icon/16/sprite.png, icon.css
 */

$info = []; // elem: dir=>{ width, height, @pics, y }
list($prog, $infile, $outfile) = $argv;
if (! isset($infile) || ! isset($outfile)) {
	die("make_sprite <src_css_file> <dst_css_file>");
}

$content = file($infile);
$fpout = fopen($outfile, "w");
chdir(dirname($infile));
foreach ($content as $ln) {
	if (! preg_match('/url\((.*?)\)/', $ln, $ms)) {
		fwrite($fpout, $ln);
		continue;
	}

	$picName = $ms[1];
	$dirName = dirname($ms[1]);
	if (! preg_match('/(\d+)$/', $dirName, $ms1)) {
		die("bad format for file: {$picName}.");
	}
	$width = $ms1[1];
	$height = $width; // TODO
	if (! array_key_exists($dirName, $info)) {
		$info[$dirName] = [
			"width" => $width,
			"y" => 0,
			"info" => [],
		];
	}
	$dir = &$info[$dirName];
	$dir["pics"][] = $picName;

	$outStr = "\tbackground-image: url({$dirName}/sprite.png);
\tbackground-size: {$width}px;
\tbackground-position-y: {$dir['y']}px;
";
	$dir["y"] -= $height;
	unset($dir);

	fwrite($fpout, $outStr);
}

fclose($fpout);
echo "=== generate css file: `{$outfile}'\n";
foreach ($info as $dirName => $dir) {
	$src = join(" ", $dir["pics"]);
	$dst = "{$dirName}/sprite.png";
	$cmd = "convert.exe {$src} -append ${dst}";
	#echo($cmd . "\n\n");
	system($cmd);
	echo "=== generate {$dst}\n";
}

