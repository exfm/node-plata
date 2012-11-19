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

module.exports.xmlToObject = function(xmlString){
    console.log('Parse xml string', xmlString);
    function isElement(xml){

    }
    function parse(xml){
        var json = {},
            children  = xml.childNodes;
        if (children === null && xml.nextSibling.childNodes !== null) {
        //if (children === null && xml.nextSibling.childNodes !== null) {
            children = xml.nextSibling.childNodes;
            Object.keys(xml.nextSibling.childNodes).forEach(function(key){
                if(children[key].tagName){
                    var child = children[key],
                        name = camelize(child.tagName);

                    if(name === 'member' || name === 'item' || name === 'bucket' || name === 'contents'){
                        if(json.length === undefined){
                            json = [];
                        }
                        json.push(parse(child));
                    }
                    else{
                        json[camelize(name)] = parse(child);
                    }
                }
            });
            return json;
        }
        else if (children.length === 1 && xml.childNodes[0].childNodes === null) {
            return children[0].data;
        }
        else if(children.length > 0){
            Object.keys(children).forEach(function(key){
                if(children[key].tagName){
                    var child = children[key],
                        name = camelize(child.tagName);

                    if(name === 'member' || name === 'item' || name === 'attribute' ||
                        name === 'bucket' || name === 'contents' || name === 'queueUrl' ||
                        name === 'sendMessageBatchResultEntry'){
                        if(json.length === undefined){
                            json = [];
                        }
                        json.push(parse(child));
                    }
                    else{
                        json[camelize(name)] = parse(child);
                    }
                }
            });
            return json;
        }
    }

    var xml = new XMLParser().parseFromString(xmlString.toString(), "text/xml"),
        response = {};
    response[camelize(xml.firstChild.nextSibling.tagName)] = parse(xml.firstChild.nextSibling);
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