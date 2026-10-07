import test from 'node:test';
import assert from 'node:assert/strict';
import { insertText, UndoState } from '../../src/lib/text.js';

test('replace is exact and append adds only the required separator', () => {
  assert.equal(insertText('old',{value:'/ci-now',mode:'replace'}),'/ci-now');
  for(const [before,expected] of [['','🧪'],['old','old\n🧪'],['old\n','old\n🧪'],['old\n\n','old\n\n🧪']]) assert.equal(insertText(before,{value:'🧪',mode:'append'}),expected);
  assert.equal(insertText('a',{value:'\nb',mode:'append'}),'a\n\nb');
  assert.equal(insertText('a',{value:'',mode:'replace'}),'');
  for (const value of ['Zażółć\r\n🧪\r\n', 'Zażółć\r🧪\r', 'Zażółć\r\n🧪\rEnd\n']) {
    assert.equal(insertText('old', {value,mode:'replace'}), value);
    assert.equal(insertText('old\n', {value,mode:'append'}), 'old\n'+value);
  }
  assert.throws(()=>insertText('a',{value:'b',mode:'publish'}));
});
test('undo keeps only the most recent value and selection and is consumed once', () => {
  const undo=new UndoState();
  undo.capture({value:'Zażółć',selectionStart:1,selectionEnd:4,selectionDirection:'backward'});
  assert.deepEqual(undo.take(),{value:'Zażółć',start:1,end:4,direction:'backward'});assert.equal(undo.take(),null);
  undo.capture({value:'first'});undo.capture({value:'second'});assert.equal(undo.take().value,'second');
  undo.capture({value:'third'});undo.clear();assert.equal(undo.take(),null);
});
