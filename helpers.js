// @ts-check
'use strict';

const path = require('path');
const childProc = require('child_process');

module.exports = {
    /**
     * Normalizes and forces a filepath to the forward slash variant
     * Example: \dir\file.txt will become /dir/file.txt
     * @param {string} filePath the path to normalize
     * @returns {string} The posix foward slashed version of the input
     */
    posixNormalize: function(filePath) {
        return path.normalize(filePath).replace(/[\/\\]{1,2}/gm, '/');
    },
    /**
     * Replaces any root level values on an object that are 0, with a different value
     * @param {object} inputObj  - The object to replace zeros on
     * @param {any} replacement - what to replace the zeros with
     * @returns {object} The object with zeros replaced
     */
    replaceZeros: function(inputObj, replacement) {
        let keys = Object.keys(inputObj);
        for (let x = 0; x < keys.length; x++) {
            if (inputObj[keys[x]] === 0) {
                inputObj[keys[x]] = replacement;
            }
        }
        return inputObj;
    },
    /**
     * Test whether or not we are in a git initialized repo space / folder
     * @returns {boolean} Whether or not in git repo
     */
    getIsInGitRepo: function(){
        try {
            childProc.execSync(`git status`);
            return true;
        }
        catch (e){
            return false;
        }
    }
}