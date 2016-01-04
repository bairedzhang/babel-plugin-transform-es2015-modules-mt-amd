"use strict";
var _Object$create = require("babel-runtime/core-js/object/create")["default"];

var _interopRequireDefault = require("babel-runtime/helpers/interop-require-default")["default"];

exports.__esModule = true;

var _babelTemplate = require("babel-template");

var _babelTemplate2 = _interopRequireDefault(_babelTemplate);
var tpl = `\n  define(MODULE_NAME, [SOURCES], function (PARAMS) {\n
                'use strict';
                var exports = {}; \n
                BODY;
                return exports.default || exports;
           \n
            });\n`
var buildDefine = _babelTemplate2["default"](tpl);

exports["default"] = function (_ref) {
    var t = _ref.types;

    function isValidRequireCall(path) {
        if (!path.isCallExpression()) return false;
        if (!path.get("callee").isIdentifier({name: "require"})) return false;
        if (path.scope.getBinding("require")) return false;

        var args = path.get("arguments");
        if (args.length !== 1) return false;

        var arg = args[0];
        if (!arg.isStringLiteral()) return false;

        return true;
    }

    var noVisitor = {
        Directive: function(path) {
           if(path.node.value.value == 'use strict') {
              path.remove();
           }
        },
    };

    var amdVisitor = {
        Directive: function(path) {
           if(path.node.value.value == 'use strict') {
              path.remove();
           }
        },

        CallExpression: function CallExpression(path) {
            if (!isValidRequireCall(path)) return;
            this.bareSources.push(path.node.arguments[0]);
            path.remove();
        },

        VariableDeclarator: function VariableDeclarator(path) {
            var id = path.get("id");
            if (!id.isIdentifier()) return;

            var init = path.get("init");
            if (!isValidRequireCall(init)) return;

            var source = init.node.arguments[0];
            this.sourceNames[source.value] = true;
            this.sources.push([id.node, source]);

            path.remove();
        }
    };

    return {
        inherits: require("babel-plugin-transform-es2015-modules-commonjs"),
        pre: function pre() {
            // source strings
            this.sources = [];
            this.sourceNames = _Object$create(null);

            this.bareSources = [];

        },

        visitor: {
            Program: {
                exit: function exit(path) {
                    // istanbul ignore next
                    if (path.scope.globals.define) {
                       path.traverse(noVisitor, this);
                       return ;
                    }
                    var _this = this;
                    var fileOpts = _this.file.opts;
                    var fileInfo = {
                        fullName: fileOpts.filename,
                        relativeName: fileOpts.filenameRelative,
                        basename: fileOpts.basename
                    };
                    if (this.ran) return;
                    this.ran = true;

                    path.traverse(amdVisitor, this);

                    var params = this.sources.map(function (source) {
                        return source[0];
                    });
                    var sources = this.sources.map(function (source) {
                        return source[1];
                    });

                    sources = sources.concat(this.bareSources.filter(function (str) {
                        return !_this.sourceNames[str.value];
                    }));

                    var module = /frontend([\\/])mods\1([^\\/]+)\1\2\.js$/g.test(fileInfo.fullName)
                        ? 'm_' + fileInfo.basename
                        : fileInfo.relativeName.replace(/\.js$/g, '');
                    var moduleName = t.stringLiteral(module);

                    path.node.body = [buildDefine({
                        MODULE_NAME: moduleName,
                        SOURCES: sources,
                        PARAMS: params,
                        BODY: path.node.body
                    })];
                }
            }
        }
    };
};

module.exports = exports["default"];
