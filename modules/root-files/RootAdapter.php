<?php
namespace Virtualia;

use League\Flysystem\Adapter\AbstractAdapter;
use League\Flysystem\Config;

final class RootAdapter extends AbstractAdapter
{
    private $actor;
    public function __construct($actor) { $this->actor = $actor; $this->setPathPrefix('/'); }

    public function invoke($operation, $arguments, $input = null, $streamOutput = false)
    {
        $arguments['root'] = true;
        $command = ['/usr/bin/sudo', '-n', '/usr/local/hestia/bin/v-vip-root-files', $this->actor,
            $operation, base64_encode(json_encode($arguments, JSON_THROW_ON_ERROR))];
        $output = tmpfile(); $error = tmpfile();
        $process = proc_open($command, [0 => ['pipe', 'r'], 1 => $output, 2 => $error], $pipes);
        if (!is_resource($process)) throw new \RuntimeException('File service unavailable');
        if (is_resource($input)) stream_copy_to_stream($input, $pipes[0]);
        elseif ($input !== null) fwrite($pipes[0], $input);
        fclose($pipes[0]);
        $status = proc_close($process); rewind($error);
        $message = trim(stream_get_contents($error)); fclose($error);
        if ($status !== 0) { fclose($output); throw new \RuntimeException($message ?: 'File operation failed'); }
        rewind($output);
        if ($streamOutput) return $output;
        $value = json_decode(stream_get_contents($output), true, 512, JSON_THROW_ON_ERROR); fclose($output);
        return $value;
    }
    public function has($path) { return $this->getMetadata($path); }
    public function getMetadata($path) { return $this->invoke('stat', ['path'=>$path]); }
    public function listContents($directory = '', $recursive = false) { return $this->invoke('list', ['path'=>$directory, 'recursive'=>$recursive]); }
    public function readStream($path) { return ['path'=>$path, 'stream'=>$this->invoke('read', ['path'=>$path], null, true)]; }
    public function read($path) { $data=$this->readStream($path); $value=stream_get_contents($data['stream']); fclose($data['stream']); return ['path'=>$path, 'contents'=>$value]; }
    public function write($path, $contents, Config $config) { return $this->invoke('write', ['path'=>$path], $contents); }
    public function writeStream($path, $resource, Config $config) { return $this->invoke('write', ['path'=>$path], $resource); }
    public function update($path, $contents, Config $config) { return $this->write($path,$contents,$config); }
    public function updateStream($path, $resource, Config $config) { return $this->writeStream($path,$resource,$config); }
    public function rename($path, $newpath) { $this->invoke('rename',['path'=>$path,'destination'=>$newpath]); return true; }
    public function copy($path, $newpath) { $this->invoke('copy',['path'=>$path,'destination'=>$newpath]); return true; }
    public function delete($path) { return $this->invoke('delete',['path'=>$path]); }
    public function deleteDir($dirname) { return $this->delete($dirname); }
    public function createDir($dirname, Config $config) { return $this->invoke('mkdir',['path'=>$dirname]); }
    public function setVisibility($path, $visibility) { return $this->invoke('chmod',['path'=>$path,'mode'=>$visibility==='public'?'644':'600']); }
    public function chmod($path, $permissions) { $this->invoke('chmod',['path'=>$path,'mode'=>(string)$permissions]); return true; }
    public function getSize($path) { $meta=$this->getMetadata($path); return $meta && $meta['type']==='file' ? $meta : false; }
    public function getMimetype($path) { return $this->getMetadata($path); }
    public function getTimestamp($path) { return $this->getMetadata($path); }
    public function getVisibility($path) { return $this->getMetadata($path); }
}
