"use strict";

var XMLParser;
if(typeof window !== "undefined" && window.DOMParser){
    XMLParser = window.DOMParser;
}
else{
    XMLParser = require('xmldom').DOMParser;
}

var camelize = module.exports.camelize = function(str){
    return str.replace(str.charAt(0), str.charAt(0).toLowerCase());
};

var listTags = [
    'member',
    'item',
    'attribute',
    'bucket',
    'contents',
    'queueUrl',
    'sendMessageBatchResultEntry'
];

module.exports.xmlToObject = function(xmlString){
    function isElement(xml){

    }
    function parse(xml){
        var json = {},
            children  = xml.childNodes,
            parentName,
            res,
            dateRegex = /\d{4}-(\d+)-(\d+)T(\d+):(\d+):(\d+).(\d+)Z/;


        if (children.length === 1 && xml.childNodes[0].childNodes === null) {
            res = children[0].data || null;
            if(res === 'true'){
                return true;
            } else if(res === 'false'){
                return false;
            }
            else if(dateRegex.test(res)){
                return new Date(res);
            }
            else if(new RegExp("[0-9]{"+res.length+"}").test(res)){
                return Number(res);
            }
            return res;
        }
        else if(children.length > 0){
            parentName = camelize(xml.tagName);
            json = {};

            Object.keys(children).forEach(function(key){
                if(children[key].tagName){
                    var child = children[key],
                        name = camelize(child.tagName);

                    if(listTags.indexOf(name) > -1){
                        if(json[camelize(name)] === undefined){
                            json[camelize(name)] = [];
                        }
                        json[camelize(name)].push(parse(child));
                    }
                    else{
                        json[camelize(name)] = parse(child);
                    }
                }
            });
            return json;
        }
        else{
            return null;
        }
    }

    var xml = new XMLParser().parseFromString(xmlString.toString(), "text/xml"),
        response = {},
        root;

    if(xml.firstChild.tagName === 'xml'){
        root = xml.firstChild.nextSibling;
    }
    else{
        root = xml.firstChild;
    }

    response[camelize(root.tagName)] = parse(root);
    return response;
};

module.exports.sortObjectByKeys = function(obj){
    var keys = Object.keys(obj),
        result = {};
    keys.sort();
    keys.forEach(function(key){
        result[key] = obj[key];
    });
    return result;
};


module.exports.toTitleCase = function (s) {
    if(s.charAt(0).match(/[a-z]/)){
        return s.charAt(0).toUpperCase() + s.substr(1, s.length - 1);
    }
    return s;
};