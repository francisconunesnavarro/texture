import { importContentLoc, exportContentLoc } from './contentLocHelpers'
import { findChild } from '../util/domHelpers'
import { PUB_ID_TYPES, REQUIRED_ELEMENT_CITATION_ELEMENTS } from '../../constants'

export default class ConvertElementCitation {

  import(dom) {
    let elementCitations = dom.findAll('element-citation')
    elementCitations.forEach((elementCitation) => {
      importContentLoc(elementCitation)
      _createEmptyElementsIfNotExist(elementCitation)
      _expandPubIds(elementCitation)
    })
  }

  export(dom) {
    let elementCitations = dom.findAll('element-citation')
    elementCitations.forEach((elementCitation) => {
      exportContentLoc(elementCitation)
      _stripEmptyElements(elementCitation)
    })
  }
}

function _createEmptyElementsIfNotExist(el) {
  REQUIRED_ELEMENT_CITATION_ELEMENTS.forEach((tagName) => {
    let childEl = findChild(el, tagName)
    if (!childEl) {
      el.append(
        el.createElement(tagName).append('')
      )
    }
  })
}

function _stripEmptyElements(el) {
  REQUIRED_ELEMENT_CITATION_ELEMENTS.forEach((tagName) => {
    let childEl = findChild(el, tagName)
    if (childEl.textContent === '') {
      el.removeChild(childEl)
    }
  })
}


/*
  We ensure that various pub-id-types are present based on the publication-type
*/
function _expandPubIds(el) {
  let publicationType = el.getAttribute('publication-type')
  let requiredPubIdTypes = PUB_ID_TYPES[publicationType]
  let numPubIds = el.findAll('pub-id').length

  if (requiredPubIdTypes !== numPubIds) {
    console.warn(`Expected ${requiredPubIdTypes} pub-ids for ${publicationType}, got ${numPubIds}`)
  }

  requiredPubIdTypes.forEach((pubIdType) => {
    let pubId = el.find(`pub-id[pub-id-type=${pubIdType}]`)
    if (!pubId) {
      el.append(
        el.createElement('pub-id').attr('pub-id-type', pubIdType)
      )
    }
  })
}
