const TYPES = {
  'journal': 'journal-article',
  'book': 'book'
}

const ELEMENT_CITATION_ENTITY_DB_MAP = {
  'articleTitle': 'article-title',
  'chapterTitle': 'chapter-title',
  'source': 'source',
  'publisherLoc': 'publisher-loc',
  'publisherName': 'publisher-name',
  'volume': 'volume',
  'year': 'year',
  'month': 'month',
  'day': 'day',
  'fpage': 'fpage',
  'lpage': 'lpage',
  'pageRange': 'page-range',
  'elocationId': 'elocation-id',
  'doi': 'pub-id'
}

export default class ImportEntities {
  /*
    During import we are extracting persons and then walk through
    entity schema to pull properties out of element-citation
    At the end we are cleaning ref elements and changing xref rids
    to ids of newly created entities

    > Note: we might need to think about id-disambiguation here,
      i.e. making sure that the local entities do not collide
      with existing ones (regarding id)... maybe it is a good
      idea not to rely on local ids at all, i.e. always convert
      local ids into global ones, where we can choose ids
      which are propability->zero to collide
  */
  import(dom, api) {
    let refs = dom.findAll('ref')

    const pubMetaDb = api.pubMetaDb

    refs.forEach((refEl) => {
      let elementCitation = refEl.find('element-citation')
      if (!elementCitation) {
        api.error('Could not find <element-citation>')
      } else {
        const entityId = _createBibliographicEntity(elementCitation, pubMetaDb)
        if(entityId) {
          // const bibRefs = dom.findAll('xref[ref-type=bibr][rid=' + refEl.id + ']')
          // bibRefs.forEach(bibRef => {
          //   bibRef.attr('rid', entityId)
          // })
          refEl.attr('rid', entityId)
          refEl.empty()
        }
      }
    })

    // We create a journal-article entity to hold meta-data of the
    // actual article. This includes node.reference (=bibliography) and
    // node.authors (person or organisation records) as well as publication
    // history etc.
    // NOTE: we call this main-article by convenstion for now. Once we connect
    // to a global entity db we would need to generate a uuid for that record
    // as well. But this should happen only and then stored in the XML for later
    // reuse of that existing record.

    // This pulls out all aff elements and creates organisation entities from it.
    _extractOrganisations(dom, pubMetaDb)
    _extractAuthors(dom, pubMetaDb, 'authors')
    _extractAuthors(dom, pubMetaDb, 'editors')
  }

  export(dom, api) {
    const pubMetaDb = api.pubMetaDb
    const entities = pubMetaDb.getNodes()
    const entityIds = Object.keys(entities)

    let back = dom.find('back')
    let refList = dom.createElement('ref-list')

    entityIds.forEach(entityId => {
      const entity = entities[entityId].toJSON()
      const ref = _createRefElement({dom, entity, pubMetaDb})
      if (ref) refList.append(ref)
    })

    back.append(
      refList
    )
  }
}

function _createBibliographicEntity(elementCitation/*, pubMetaDb*/) {
  let pubType = elementCitation.attr('publication-type')

  if (!pubType) throw new Error('element-citation[publication-type] is mandatory')
  // TODO: support the different pub-types and create
  // related entities as well (e.g. for authors)
  let type = TYPES[pubType]
  if(!type) {
    console.error('TODO: implement entity importer for', pubType, 'entity type')
    return
  }

  let entityId = _getTextFromDOM(elementCitation, 'pub-id[pub-id-type=entity]')

  // HACK: we assume that the entity already exists in the db

  // Extract authors and editors from element-citation
  // const persons = _extractPersons(elementCitation, pubMetaDb)
  // let record = {
  //   id: elementCitation.getParent().id,
  //   type,
  //   authors: persons.author,
  //   editors: persons.editor
  // }

  // Extract all other attributes for a certain pub-type
  // and populate entity record
  // const nodes = _getEntityNodes(type, pubMetaDb)
  // nodes.forEach(node => {
  //   const prop = _getElementCitationProperty(node, elementCitation)
  //   if(prop) record[node] = prop
  // })
  // // Create record
  // const entity = pubMetaDb.create(record)

  return entityId
}

// Creating ref element from given entity record
function _createRefElement({dom, entity, pubMetaDb}) {
  // We don't want to convert person entities to XML
  // we want to create name element for each person reference
  if(entity.type === 'person') return

  const pubType = Object.keys(TYPES).find(type => {
    return TYPES[type] === entity.type
  })

  if(!pubType) {
    console.error('TODO: implement entity exporter for', entity.type, 'entity type')
    return
  }

  let ref = dom.createElement('ref').attr('id', entity.id)
  let elementCitation = dom.createElement('element-citation').attr('publication-type', pubType)

  Object.keys(ELEMENT_CITATION_ENTITY_DB_MAP).forEach(prop => {
    const value = entity[prop]
    const elName = ELEMENT_CITATION_ENTITY_DB_MAP[prop]
    if(value) {
      let el = dom.createElement(elName).append(value)

      if(elName === 'year') {
        el.attr('iso-8601-date', value)
      } else if(elName === 'pub-id') {
        el.attr('pub-id-type', 'doi')
      }

      elementCitation.append(el)
    }
  })

  _injectPersons({elementCitation, entity, pubMetaDb})

  ref.append(elementCitation)
  return ref
}

// Extract persons from element citation, create entites
// and returns their ids grouped by person type
// function _extractPersons(elementCitation, pubMetaDb) {
//   let result = {
//     author: [],
//     editor: []
//   }
//
//   const personGroups = elementCitation.findAll('person-group')
//   personGroups.forEach(group => {
//     const type = group.attr('person-group-type')
//     const persons = group.findAll('name')
//     persons.forEach(person => {
//       let record = {
//         type: 'person'
//       }
//       const surname = person.find('surname')
//       if(surname) record.surname = surname.text()
//       const givenNames = person.find('given-names')
//       if(givenNames) record.givenNames = givenNames.text()
//       const suffix = person.find('suffix')
//       if(suffix) record.suffix = suffix.text()
//       const prefix = person.find('prefix')
//       if(prefix) record.prefix = prefix.text()
//
//       // let entity = pubMetaDb.create(record)
//       // // We may get a random entityId
//       // entityId = entity.id
//       // if(result[type]) result[type].push(entityId)
//     })
//   })
//
//   return result
// }

// Injecting person-groups to element-citation
// persons pulled out from pubMetaDb
function _injectPersons({elementCitation, entity, pubMetaDb}) {
  const authors = entity.authors
  const authorsEl = elementCitation.createElement('person-group')
    .attr('person-group-type', 'author')

  authors.forEach(author => {
    authorsEl.append(_createNameElement(authorsEl, pubMetaDb.get(author).toJSON()))
  })

  const editors = entity.editors
  const editorsEl = elementCitation.createElement('person-group')
    .attr('person-group-type', 'editor')

  editors.forEach(editor => {
    editorsEl.append(_createNameElement(editorsEl, pubMetaDb.get(editor).toJSON()))
  })

  elementCitation.append(
    authorsEl,
    editorsEl
  )
}

// Create name element with person populated from entity
function _createNameElement(el, person) {
  let nameEl = el.createElement('name')
  nameEl.append(
    el.createElement('surname').append(person.surname),
    el.createElement('given-names').append(person.givenNames)
  )
  if (person.prefix) {
    nameEl.append(
      el.createElement('prefix').append(person.prefix)
    )
  }
  if (person.suffix) {
    nameEl.append(
      el.createElement('suffix').append(person.suffix)
    )
  }
  return nameEl
}

/* HELPERS */

// Returns list of entity properties
// function _getEntityNodes(type, pubMetaDb) {
//   const pubMetaDbSchema = pubMetaDb.getSchema()
//   const nodeClass = pubMetaDbSchema.getNodeClass(type)
//   return Object.keys(nodeClass.schema)
// }
//
// // Get child property value of element-citation
// function _getElementCitationProperty(prop, elementCitation) {
//   let result
//   const xmlProp = ELEMENT_CITATION_ENTITY_DB_MAP[prop]
//   if(xmlProp) {
//     const propEl = elementCitation.find(xmlProp)
//     if(propEl) result = propEl.text()
//   }
//   return result
// }


/*
<aff id="aff1">
  <institution content-type="orgname">Settles-Young Research Corporation</institution>
  <institution content-type="orgdiv1">Laboratory of Neural Systems</institution>
  <addr-line content-type="address-street">283 Hawthorne Drive</addr-line>
  <addr-line content-type="complements">Suite 310</addr-line>
  <city>Lexington</city>
  <state>KY</state>
  <postal-code>40503</postal-code>
  <country>USA</country>
  <phone>(859) 273-8543</phone>
  <fax>(859) 299-4683</fax>
  <email>lsy@settles-young.com</email>
  <uri>http://www.settles-young.com</uri>
</aff>
*/
function _extractOrganisations(dom/*, pubMetaDb*/) {
  let affs = dom.findAll('article-meta > aff')

  affs.forEach(aff => {
    let entityId = _getTextFromDOM(aff, 'uri[content-type=entity]')
    // let node = {
    //   id: entityId,
    //   type: 'organisation',
    //   name: _getTextFromDOM(aff, 'institution[content-type=orgname]'),
    //   division1: _getTextFromDOM(aff, 'institution[content-type=orgdiv1]'),
    //   division2: _getTextFromDOM(aff, 'institution[content-type=orgdiv2]'),
    //   division3: _getTextFromDOM(aff, 'institution[content-type=orgdiv3]'),
    //   street: _getTextFromDOM(aff, 'addr-line[content-type=address-street]'),
    //   addressComplements: _getTextFromDOM(aff, 'addr-line[content-type=complements]'),
    //   city: _getTextFromDOM(aff, 'city'),
    //   state: _getTextFromDOM(aff, 'state'),
    //   postalCode: _getTextFromDOM(aff, 'postal-code'),
    //   country: _getTextFromDOM(aff, 'country'),
    //   phone: _getTextFromDOM(aff, 'phone'),
    //   fax: _getTextFromDOM(aff, 'fax'),
    // }

    // HACK: disable auto-creation for now
    // pubMetaDb.create(node)
    aff.setAttribute('rid', entityId)
    aff.empty()
  })


}

/*
<contrib-group content-type="authors">
  <contrib contrib-type="author" rid="person1">
    <name>
      <surname>Doe</surname><given-names>Jane</given-names>
    </name>
    <xref ref-type="aff" rid="aff1"/>
  </contrib>
</contrib-group>
*/
function _extractAuthors(dom, pubMetaDb, type) {
  let contribGroup = dom.find(`contrib-group[content-type=${type}]`)
  if (!contribGroup) return []
  let contribs = contribGroup.findAll('contrib')
  contribs.forEach(contrib => {
    // let orgIds = contrib.findAll('xref[ref-type=aff]').map(xref => {
    //   let affId = xref.getAttribute('rid')
    //   return dom.find(`aff#${affId}`).getAttribute('rid')
    // })
    // We now need to translate internal aff ids to global entity ids
    // let orgIds = affIds.map()
    let entityId = _getTextFromDOM(contrib, 'contrib-id[contrib-id-type=entity]')
    if (!pubMetaDb.get(entityId)) {
      throw new Error(`Entity ${entityId} not found in db.`)
    }
    // let node = {
    //   id: entityId,
    //   type: 'person',
    //   surname: _getTextFromDOM(contrib, 'surname'),
    //   givenNames: _getTextFromDOM(contrib, 'given-names'),
    //   prefix: _getTextFromDOM(contrib, 'prefix'),
    //   suffix: _getTextFromDOM(contrib, 'suffix'),
    //   affiliations: orgIds
    // }
    // if (!entityId || !pubMetaDb.get(entityId)) {
    //   node = pubMetaDb.create(node)
    // }
    // Assign id if not present
    contrib.setAttribute('rid', entityId)
    contrib.empty()
  })

}

function _getTextFromDOM(rootEl, selector) {
  let match = rootEl.find(selector)
  if (match) {
    return match.textContent
  } else {
    return ''
  }
}
