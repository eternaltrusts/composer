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

const ConnectionProfileManager = require('./connectionprofilemanager');

/**
 * Base class representing a connection manager that establishes and manages
 * connections to one or more business networks. The ConnectionManager loads
 * connection profiles using the ConnectionProfileManager.
 *
 * @private
 * @abstract
 * @class
 * @memberof module:concerto-common
 */
class ConnectionManager {

  /**
   * Create the ConnectionManager
   * @param {ConnectionProfileManager} connectionProfileManager - the ConnectionProfileManager
   * that controls this instance.
   */
    constructor(connectionProfileManager) {
        if(!(connectionProfileManager instanceof ConnectionProfileManager)) {
            throw new Error('Must create ConnectionManager with a ConnectionProfileManager implementation.');
        }

        this.connectionProfileManager = connectionProfileManager;
    }

    /**
     * Returns the ConnectionProfileManager associated with this ConnectionManager
     * @return {ConnectionProfileManager} the connection profile manager for this
     * connection manager.
     */
    getConnectionProfileManager() {
        return this.connectionProfileManager;
    }

    /**
     * Establish a connection to the business network, using connection information
     * from the connection profile.
     *
     * @param {string} connectionProfile The name of the connection profile
     * @param {string} businessNetworkIdentifier The identifier of the business network, or null if this is an admin connection
     * @param {object} connectionOptions The connection options loaded from the profile
     * @return {Promise} A promise that is resolved with a {@link Connection}
     * object once the connection is established, or rejected with a connection error.
     * @abstract
     */
    connect(connectionProfile, businessNetworkIdentifier, connectionOptions) {
        return Promise.reject(new Error('abstract function called'));
    }

    /**
     * Stop serialization of this object.
     * @return {Object} An empty object.
     */
    toJSON() {
        return {};
    }
}

module.exports = ConnectionManager;
