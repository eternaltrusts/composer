/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

'use strict';

const Field = require('./field');
const EnumValueDeclaration = require('./enumvaluedeclaration');
const RelationshipDeclaration = require('./relationshipdeclaration');
const IllegalModelException = require('./illegalmodelexception');
const Globalize = require('../globalize');

/**
 * ClassDeclaration defines the structure (model/schema) of composite data.
 * It is composed of a set of Properties, may have an identifying field, and may
 * have a super-type.
 * A ClassDeclaration is conceptually owned with a ModelFile which
 * defines all the classes that are part of a namespace.
 *
 * @private
 * @abstract
 * @class
 * @memberof module:concerto-common
 */
class ClassDeclaration {

    /**
     * Create a ClassDeclaration from an Abstract Syntax Tree. The AST is the
     * result of parsing.
     *
     * @param {ModelFile} modelFile - the ModelFile for this class
     * @param {string} ast - the AST created by the parser
     * @throws {IllegalModelException}
     */
    constructor(modelFile, ast) {
        if(!modelFile || !ast) {
            throw new IllegalModelException(Globalize.formatMessage('classdeclaration-constructor-modelastreq'));
        }

        this.ast = ast;
        this.modelFile = modelFile;
        this.process();
    }

    /**
     * Visitor design pattern
     * @param {Object} visitor - the visitor
     * @param {Object} parameters  - the parameter
     * @return {Object} the result of visiting or null
     * @private
     */
    accept(visitor,parameters) {
        return visitor.visit(this, parameters);
    }

    /**
     * Returns the ModelFile that defines this class.
     *
     * @return {ModelFile} the owning ModelFile
     */
    getModelFile() {
        return this.modelFile;
    }

    /**
     * Process the AST and build the model
     *
     * @throws {InvalidModelException}
     * @private
     */
    process() {
        this.name = this.ast.id.name;
        this.properties = [];
        this.superType = null;
        this.idField = null;
        this.abstract = false;

        if(this.ast.abstract) {
            this.abstract = true;
        }

        if(this.ast.classExtension) {
            this.superType = this.ast.classExtension.class.name;
        }

        if(this.ast.idField) {
            this.idField = this.ast.idField.name;
        }

        for(let n=0; n < this.ast.body.declarations.length; n++ ) {
            let thing = this.ast.body.declarations[n];

            //console.log('Found: ' + thing.type + ' ' + thing.id.name);

            if(thing.type === 'FieldDeclaration') {
                this.properties.push( new Field(this, thing) );
            }
            else if(thing.type === 'RelationshipDeclaration') {
                this.properties.push( new RelationshipDeclaration(this, thing) );
            }
            else if(thing.type === 'EnumPropertyDeclaration') {
                this.properties.push( new EnumValueDeclaration(this, thing) );
            }
            else {
                let formatter = Globalize.messageFormatter('classdeclaration-process-unrecmodelelem');
                throw new IllegalModelException(formatter({
                    'type': thing.type
                }));
            }
        }
    }

    /**
     * Semantic validation of the structure of this class. Subclasses should
     * override this method to impose additional semantic constraints on the
     * contents/relations of fields.
     *
     * @throws {InvalidModelException}
     * @private
     */
    validate() {
        // TODO (LG) check that all imported classes exist, rather than just
        // used imports

        // if we have a super type make sure it exists
        if(this.superType!==null) {
            let classDecl = null;
            if(this.getModelFile().isImportedType(this.superType)) {
                let fqnSuper = this.getModelFile().resolveImport(this.superType);
                classDecl = this.modelFile.getModelManager().getType(fqnSuper);
            }
            else {
                classDecl = this.getModelFile().getType(this.superType);
            }

            if(classDecl===null) {
                throw new IllegalModelException('Could not find super type ' + this.superType);
            }
        }

        // TODO (DCS) we need to validate that the super type is compatible
        // with this class. e.g. an asset cannot extend a transaction...

        if(this.idField) {
            const field = this.getProperty(this.idField);
            if(!field) {
                let formatter = Globalize('en').messageFormatter('classdeclaration-validate-identifiernotproperty');
                throw new IllegalModelException(formatter({
                    'class': this.name,
                    'idField': this.idField
                }));
            }
            else {
                // check that identifiers are strings
                if(field.getType() !== 'String') {
                    let formatter = Globalize('en').messageFormatter('classdeclaration-validate-identifiernotstring');
                    throw new IllegalModelException( formatter({
                        'class': this.name,
                        'idField': this.idField
                    }));
                }

                if(field.isOptional()) {
                    throw new IllegalModelException('Identifying fields cannot be optional.');
                }
            }
        }

        // we also have to check fields defined in super classes
        const properties = this.getProperties();
        for(let n=0; n < properties.length; n++) {
            let field = properties[n];

            // check we don't have a field with the same name
            for(let i=n+1; i < properties.length; i++) {
                let otherField = properties[i];
                if(field.getName() === otherField.getName()) {
                    let formatter = Globalize('en').messageFormatter('classdeclaration-validate-duplicatefieldname');
                    throw new IllegalModelException( formatter({
                        'class': this.name,
                        'fieldName': field.getName()
                    }));
                }
            }

            field.validate(this);
        }
    }

    /**
     * Returns true if this class is declared as abstract in the model file
     *
     * @return {boolean} true if the class is abstract
     */
    isAbstract() {
        return this.abstract;
    }

    /**
     * Returns true if this class is an enumeration.
     *
     * @return {boolean} true if the class is an enumerated type
     */
    isEnum() {
        return false;
    }

    /**
     * Returns true if this class is the definition of a concept.
     *
     * @return {boolean} true if the class is a concept
     */
    isConcept() {
        return false;
    }

    /**
     * Returns true if this class can be pointed to by a relationship
     *
     * @return {boolean} true if the class may be pointed to by a relationship
     */
    isRelationshipTarget() {
        return false;
    }

    /**
     * Returns the short name of a class. This name does not include the
     * namespace from the owning ModelFile.
     *
     * @return {string} the short name of this class
     */
    getName() {
        return this.name;
    }

    /**
     * Returns the fully qualified name of this class.
     * The name will include the namespace if present.
     *
     * @return {string} the fully-qualified name of this class
     */
    getFullyQualifiedName() {
        return this.modelFile.getNamespace() + '.' + this.name;
    }

    /**
     * Returns the name of the identifying field for this class. Note
     * that the identifying field may come from a super type.
     *
     * @return {string} the name of the id field for this class
     */
    getIdentifierFieldName() {

        if(this.idField) {
            return this.idField;
        }
        else {
            if(this.getSuperType()) {
                let classDecl = this.modelFile.getModelManager().getType(this.getSuperType());
                return classDecl.getIdentifierFieldName();
            }
            else {
                return null;
            }
        }
    }

    /**
     * Returns the field with a given name or null if it does not exist.
     * The field must be directly owned by this class -- the super-type is
     * not introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field definition or null if it does not exist.
     */
    getOwnProperty(name) {
        for(let n=0; n < this.properties.length; n++) {
            const field = this.properties[n];
            if(field.getName() === name) {
                return field;
            }
        }

        return null;
    }

    /**
     * Returns the fields directly defined by this class.
     *
     * @return {Property[]} the array of fields
     */
    getOwnProperties() {
        return this.properties;
    }

    /**
     * Returns the FQN of the super type for this class or null if this
     * class does not have a super type.
     *
     * @return {string} the FQN name of the super type or null
     */
    getSuperType() {
        if(this.superType) {
            const type = this.getModelFile().getType(this.superType);
            if(type === null) {
                throw new Error('Could not find super type:' + this.superType );
            }
            else {
                return type.getFullyQualifiedName();
            }
        }

        return null;
    }

    /**
     * Returns the property with a given name or null if it does not exist.
     * Fields defined in super-types are also introspected.
     *
     * @param {string} name the name of the field
     * @return {Property} the field, or null if it does not exist
     */
    getProperty(name) {
        let result = this.getOwnProperty(name);
        let classDecl = null;

        if(result === null && this.superType!==null) {
            if(this.getModelFile().isImportedType(this.superType)) {
                let fqnSuper = this.getModelFile().resolveImport(this.superType);
                classDecl = this.modelFile.getModelManager().getType(fqnSuper);
            }
            else {
                classDecl = this.getModelFile().getType(this.superType);
            }
            result = classDecl.getProperty(name);
        }

        return result;
    }

    /**
     * Returns the properties defined in this class and all super classes.
     *
     * @return {Property[]} the array of fields
     */
    getProperties() {
        let result = this.getOwnProperties();
        let classDecl = null;
        if(this.superType!==null) {
            if(this.getModelFile().isImportedType(this.superType)) {
                let fqnSuper = this.getModelFile().resolveImport(this.superType);
                classDecl = this.modelFile.getModelManager().getType(fqnSuper);
            }
            else {
                classDecl = this.getModelFile().getType(this.superType);
            }

            if(classDecl===null) {
                throw new IllegalModelException('Could not find super type ' + this.superType);
            }

            // go get the fields from the super type
            result = result.concat(classDecl.getProperties());
        }
        else {
            // console.log('No super type for ' + this.getName() );
        }

        return result;
    }

    /**
     * Stop serialization of this object.
     * @return {Object} An empty object.
     */
    toJSON() {
        return {};
    }

    /**
     * Returns the string representation of this class
     * @return {String} the string representation of the class
     */
    toString() {
        let superType = '';
        if(this.superType) {
            superType = ' super=' + this.superType;
        }
        return 'ClassDeclaration {id=' + this.getFullyQualifiedName() + superType + ' enum=' + this.isEnum() + ' abstract=' + this.isAbstract() + '}';
    }
}

module.exports = ClassDeclaration;
