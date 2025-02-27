let chalk = require('chalk')
let bytes = require('bytes')

function createJsonReporter (process) {
  function print (data) {
    process.stdout.write(JSON.stringify(data, null, 2) + '\n')
  }

  return {
    error (err) {
      print({ error: err.stack })
    },

    results (plugins, config) {
      print(config.checks.map(i => {
        let result = { name: i.name }
        if (typeof i.passed !== 'undefined') result.passed = i.passed
        if (typeof i.size !== 'undefined') result.size = i.size
        if (typeof i.runTime !== 'undefined') result.running = i.runTime
        if (typeof i.loadTime !== 'undefined') result.loading = i.loadTime
        return result
      }))
    }
  }
}

function createHumanReporter (process) {
  function print (...lines) {
    process.stdout.write('  ' + lines.join('\n  ') + '\n')
  }

  function formatBytes (size) {
    return bytes.format(size, { unitSeparator: ' ' })
  }

  function formatTime (seconds) {
    if (seconds >= 1) {
      return (Math.ceil(seconds * 10) / 10) + ' s'
    } else {
      return Math.ceil(seconds * 1000) + ' ms'
    }
  }

  return {
    error (err) {
      if (err.name === 'SizeLimitError') {
        let msg = err.message
          .split('. ')
          .map(i => i.replace(/\*([^*]+)\*/g, chalk.yellow('$1')))
          .join('.\n        ')
        process.stderr.write(
          `${ chalk.bgRed.black(' ERROR ') } ${ chalk.red(msg) }\n`
        )
        if (err.example) {
          process.stderr.write(
            '\n' + err.example
              .replace(/("[^"]+"):/g, chalk.green('$1') + ':')
              .replace(/: ("[^"]+")/g, ': ' + chalk.yellow('$1'))
          )
        }
      } else {
        process.stderr.write(
          `${ chalk.bgRed.black(' ERROR ') } ${ chalk.red(err.stack) }\n`
        )
      }
    },

    results (plugins, config) {
      print('')
      for (let check of config.checks) {
        let unlimited = typeof check.passed === 'undefined'
        let rows = []

        if (config.checks.length > 1) {
          print(chalk.bold(check.name))
        }

        let sizeNote
        if (check.config) {
          sizeNote = 'with given webpack configuration'
        } else if (plugins.has('webpack') && check.gzip === false) {
          sizeNote = 'with all dependencies and minified'
        } else if (plugins.has('webpack')) {
          sizeNote = 'with all dependencies, minified and gzipped'
        } else if (plugins.has('gzip')) {
          sizeNote = 'gzipped'
        }
        let sizeString = formatBytes(check.size)

        if (typeof check.timeLimit !== 'undefined') {
          if (check.passed === false) {
            print(chalk.red('Total time limit has exceeded'))
          }
          rows.push(['Time limit', formatTime(check.timeLimit)])
        }
        if (typeof check.sizeLimit !== 'undefined') {
          let sizeLimitString = formatBytes(check.sizeLimit)
          if (check.passed === false) {
            if (sizeLimitString === sizeString) {
              sizeLimitString = check.sizeLimit + ' B'
              sizeString = check.size + ' B'
            }
            let diff = formatBytes(check.size - check.sizeLimit)
            print(chalk.red(`Package size limit has exceeded by ${ diff }`))
          }
          rows.push(['Size limit', sizeLimitString])
        }

        if (typeof check.size !== 'undefined') {
          rows.push(['Size', sizeString, sizeNote])
        }
        if (typeof check.loadTime !== 'undefined') {
          rows.push(['Loading time', formatTime(check.loadTime), 'on slow 3G'])
        }
        if (typeof check.runTime !== 'undefined') {
          rows.push(
            ['Running time', formatTime(check.runTime), 'on Snapdragon 410'],
            ['Total time', formatTime(check.time)]
          )
        }

        let max0 = Math.max(...rows.map(row => row[0].length))
        let max1 = Math.max(...rows.map(row => row[1].length))

        for (let [name, value, note] of rows) {
          let str = (name + ':').padEnd(max0 + 1) + ' '
          if (note) value = value.padEnd(max1)
          value = chalk.bold(value)
          if (unlimited || name.includes('Limit')) {
            str += value
          } else if (check.passed) {
            str += chalk.green(value)
          } else {
            str += chalk.red(value)
          }
          if (note) {
            str += ' ' + chalk.gray(note)
          }
          print(str)
        }
        print('')
      }

      if (config.failed) {
        let fix = 'Try to reduce size or increase limit'
        if (config.configPath) {
          if (config.configPath.endsWith('package.json')) {
            fix += ` in ${ chalk.bold('"size-limit"') } section of `
          } else {
            fix += ` at `
          }
          fix += chalk.bold(config.configPath)
        }
        print(chalk.yellow(fix))
      }
    }
  }
}

module.exports = (process, isJSON) => {
  return isJSON ? createJsonReporter(process) : createHumanReporter(process)
}
