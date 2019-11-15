import ts from 'typescript'
import {Tree} from './tree'
import {TypeNode, TypeNodeHandler, toTitleCase} from './type-nodes'
import {PrimitiveNode} from './type-nodes/primitive'

export class TypeNodeTree {
  private _root: TypeNode
  private _tree: Tree<TypeNode>
  private _checker: ts.TypeChecker
  private _handlers: TypeNodeHandler[]

  constructor(rootNode: TypeNode, checker: ts.TypeChecker, handlers: TypeNodeHandler[]) {
    this._root = rootNode
    this._tree = new Tree<TypeNode>(rootNode)
    this._checker = checker
    this._handlers = handlers
    this.buildTree(rootNode)
  }

  registerNodeHandler(handler: TypeNodeHandler) {
    this._handlers.push(handler)
  }

  getTree() {
    return this._tree
  }

  static createLensIdentifier(originType: string, prop: string) {
    return `get${toTitleCase(prop)}From${toTitleCase(originType)}`
  }

  static genLens(originType: string, prop: string) {
    const value = `const ${TypeNodeTree.createLensIdentifier(
      originType,
      prop
    )} = Lens.fromProp<${originType}>()('${prop}')`
    return value
  }

  static genRecordLens(originType: string, prop: string, idField = 'id') {
    const value = `const ${TypeNodeTree.createLensIdentifier(
      originType,
      prop
    )} = Lens.fromProp<Record<${originType}['${idField}'], ${originType}>>()`
    return value
  }

  static genTraversal(traversalId: string) {
    const value = `const ${traversalId.toLowerCase()}Traversal = fromTraversable(array)<${traversalId}>()`
    return value
  }

  private buildTree(node: TypeNode = this._root): Tree<TypeNode> {
    if (node.typeSymbols.length === 0) {
      return this._tree
    }
    const members = node.typeSymbols[0] ? node.typeSymbols[0].members : undefined
    if (members === undefined) {
      return this._tree
    }
    members.forEach(({valueDeclaration}) => {
      if (valueDeclaration && ts.isPropertySignature(valueDeclaration)) {
        const handled = this._handlers.some(handler => {
          if (handler.isDeclarationOfTypeNode(valueDeclaration)) {
            const createdNode = handler.createNode(this._checker, node, valueDeclaration)
            this._tree.addChild(createdNode)
            this.buildTree(createdNode)
            return true
          }
        })
        if (!handled) {
          const createdNode = new PrimitiveNode(this._checker, node, valueDeclaration)
          this._tree.addChild(createdNode)
          this.buildTree(createdNode)
        }
      }
    })
    return this._tree
  }
}
