#!/usr/bin/env node

const yargs = require('yargs');
const nginx = require('../lib/nginx');
const versions = require('../lib/versions');

yargs
  .scriptName('m2env')
  .locale('en')
  .command('$0 <magento> [php]', 'Create a new Magento 2 Docker image.', (yargs) => {
    yargs
      .positional('magento', {
        type: 'string',
        describe: 'A M2 version with format x.x.x .'
      })
      .option('p', {
        alias: 'php',
        describe: 'Version of PHP to use with format x.x .'
      })
  }, async (argv) => {
    const magento = versions.clean(argv.magento);
    // TODO: validate magento version!
    // TODO: Use chalk and boxen for pretty output
    const phpversion = versions.clean(argv.php, 2) || versions.phpversion(magento);
    await nginx.buildImage(phpversion);
  })
  .argv;
