#!/usr/bin/env node
import { globbySync } from 'globby'
import fs from 'node:fs'
import sortPackageJson from './index.js'
import Reporter from './reporter.js'

/** @param {import("node:stream").Stream} stream */
async function streamToString(stream) {
  // see https://stackoverflow.com/a/63361543/6051261
  const chunks = []

  for await (const chunk of stream) {
    chunks.push(Buffer.from(chunk))
  }

  return Buffer.concat(chunks).toString('utf-8')
}

function showVersion() {
  const { name, version } = JSON.parse(
    fs.readFileSync(new URL('package.json', import.meta.url)),
  )

  console.log(`${name} ${version}`)
}

function showHelpInformation() {
  console.log(
    `Usage: sort-package-json [options] [file/glob ...]

Sort package.json files.
If file/glob is omitted, './package.json' file will be processed.

  -c, --check   Check if files are sorted
  -q, --quiet   Don't output success messages
  -h, --help    Display this help
  -v, --version Display the package version
  --stdin       Reads package.json from stdin
  `,
  )
}

function sortPackageJsonFile(file, reporter, isCheck) {
  const original = fs.readFileSync(file, 'utf8')
  const sorted = sortPackageJson(original)
  if (sorted === original) {
    return reporter.reportNotChanged(file)
  }

  if (!isCheck) {
    fs.writeFileSync(file, sorted)
  }

  reporter.reportChanged(file)
}

function sortPackageJsonFiles(patterns, options) {
  const files = globbySync(patterns)
  const reporter = new Reporter(files, options)
  const { isCheck } = options

  for (const file of files) {
    try {
      sortPackageJsonFile(file, reporter, isCheck)
    } catch (error) {
      reporter.reportFailed(file, error)
    }
  }

  reporter.printSummary()
}

async function sortPackageJsonFromStdin() {
  console.log(sortPackageJson(await streamToString(process.stdin)))
}

function run() {
  const cliArguments = process.argv.slice(2)

  if (
    cliArguments.some((argument) => argument === '--help' || argument === '-h')
  ) {
    return showHelpInformation()
  }

  if (
    cliArguments.some(
      (argument) => argument === '--version' || argument === '-v',
    )
  ) {
    return showVersion()
  }

  if (cliArguments.some((argument) => argument === '--stdin')) {
    return sortPackageJsonFromStdin()
  }

  const patterns = []
  let isCheck = false
  let shouldBeQuiet = false

  for (const argument of cliArguments) {
    if (argument === '--check' || argument === '-c') {
      isCheck = true
    } else if (argument === '--quiet' || argument === '-q') {
      shouldBeQuiet = true
    } else {
      patterns.push(argument)
    }
  }

  if (!patterns.length) {
    patterns[0] = 'package.json'
  }

  sortPackageJsonFiles(patterns, { isCheck, shouldBeQuiet })
}

run()
