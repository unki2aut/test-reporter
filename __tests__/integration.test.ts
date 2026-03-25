import {jest, describe, it, expect} from '@jest/globals'
import fs from 'fs'
import {fileURLToPath} from 'url'
import {dirname} from 'path'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const input: Record<string, string> = {
  name: 'Test Results',
  path: 'test-report.xml',
  reporter: 'pytest-junit',
  'path-replace-backslashes': 'false',
  'list-suites': 'all',
  'list-tests': 'all',
  'max-annotations': '10',
  'fail-on-error': 'true',
  'fail-on-empty': 'true',
  'only-summary': 'false',
  'use-actions-summary': 'false',
  'badge-title': 'tests',
  'report-title': '',
  collapsed: 'auto',
  'directory-mapping': 'mnt/extra-addons:mypath',
  token: '***'
}

const update = jest.fn().mockReturnValue({data: {}, status: 0})

jest.unstable_mockModule('@actions/core', () => ({
  getInput: jest.fn().mockImplementation((name: string) => input[name as keyof typeof input] ?? ''),
  setFailed: jest.fn(),
  setOutput: jest.fn(),
  startGroup: jest.fn(),
  endGroup: jest.fn(),
  info: jest.fn(),
  warning: jest.fn(),
  summary: {
    addRaw: jest.fn().mockReturnThis(),
    write: jest.fn()
  }
}))

jest.unstable_mockModule('@actions/github', () => ({
  getOctokit: jest.fn().mockReturnValue({
    rest: {
      checks: {
        update,
        create: jest.fn().mockReturnValue({data: {html_url: 'https://example.com'}})
      }
    }
  }),
  context: {
    eventName: '',
    payload: {}
  }
}))

const {LocalFileProvider} = await import('../src/input-providers/local-file-provider.js')
jest.unstable_mockModule('../src/input-providers/local-file-provider.js', () => ({
  LocalFileProvider: jest.fn().mockImplementation(() => ({
    load: jest.fn(),
    listTrackedFiles: jest.fn()
  }))
}))

describe('integration test', () => {
  it('pytest', async () => {
    // Setup the mock before importing main
    const mockLoad = jest.fn().mockResolvedValue({
      'report-tb-short.xml': [
        {
          file: 'report-tb-short.xml',
          content: fs.readFileSync(__dirname + '/fixtures/external/pytest/report-tb-short.xml', {encoding: 'utf8'})
        }
      ]
    })
    const mockListTrackedFiles = jest.fn().mockResolvedValue(['mypath/product_changes/tests/first_test.py'])

    jest.unstable_mockModule('../src/input-providers/local-file-provider.js', () => ({
      LocalFileProvider: jest.fn().mockImplementation(() => ({
        load: mockLoad,
        listTrackedFiles: mockListTrackedFiles
      }))
    }))

    await import('../src/main.js')
    // trick to wait for the pending "main" Promise
    await new Promise(resolve => setTimeout(resolve))

    expect(update).toHaveBeenCalledTimes(1)
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        output: expect.objectContaining({
          annotations: [
            expect.objectContaining({
              path: 'mypath/product_changes/tests/first_test.py'
            })
          ]
        })
      })
    )
  })
})
