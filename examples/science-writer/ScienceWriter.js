'use strict';

var Component = require('substance/ui/Component');
var DocumentSession = require('substance/model/DocumentSession');
var Author = require('../../packages/author/Author');
var JATSTransformer = require('../../packages/author/JATSTransformer');

/*
  ScienceWriter Component

  Based on given props displays an editor or viewer
*/
function ScienceWriter() {
  Component.apply(this, arguments);

  var configurator = this.props.configurator;
  this.xmlStore = configurator.getXMLStore();
}

ScienceWriter.Prototype = function() {

  this.getChildContext = function() {
    return {
      xmlStore: this.xmlStore
    };
  };

  this.getInitialState = function() {
    return {
      documentSession: null,
      error: null
    };
  };

  this.didMount = function() {
    // load the document after mounting
    this._loadDocument(this.props.documentId);
  };

  this.willReceiveProps = function(newProps) {
    if (newProps.documentId !== this.props.documentId) {
      this.dispose();
      this.state = this.getInitialState();
      this._loadDocument(newProps.documentId);
    }
  };

  this._loadDocument = function() {
    var configurator = this.props.configurator;

    this.xmlStore.readXML(this.props.documentId, function(err, xml) {
      if (err) {
        console.error(err);
        this.setState({
          error: new Error('Loading failed')
        });
        return;
      }

      var importer = configurator.createImporter('jats');

      var doc = importer.importDocument(xml);
      var trafo = new JATSTransformer();
      doc = trafo.fromJATS(doc);

      // HACK: For debug purposes
      window.doc = doc;
      var documentSession = new DocumentSession(doc);

      this.setState({
        documentSession: documentSession
      });
    }.bind(this));
  };

  // Rendering
  // ------------------------------------

  this.render = function($$) {
    var configurator = this.props.configurator;
    var el = $$('div').addClass('sc-science-writer');

    if (this.state.error) {
      el.append('ERROR: ', this.state.error.message);
      return el;
    }

    if (!this.state.documentSession) {
      return el;
    }

    // Display reader for mobile and writer on desktop
    el.append(
      $$(Author, {
        documentId: this.props.documentId,
        documentSession: this.state.documentSession,
        configurator: configurator
      }).ref('publisher')
    );
    return el;
  };
};

Component.extend(ScienceWriter);

module.exports = ScienceWriter;
