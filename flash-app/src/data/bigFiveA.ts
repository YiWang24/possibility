// Big Five facets 1-15 (N1..C3). Part of BIG_FIVE_FACETS; see ./bigFive.

import type { BigFiveFacet } from './bigFive';

export const BIG_FIVE_FACETS_A: BigFiveFacet[] = [
  {
    d: 'N',
    f: 'N1',
    name: '焦虑',
    items: [
      ['我常为事情担心', false],
      ['我容易设想最坏的结果', false],
      ['许多事情会让我感到害怕', false],
      ['我很容易感到压力', false],
    ],
  },
  {
    d: 'E',
    f: 'E1',
    name: '友善',
    items: [
      ['我很容易结交新朋友', false],
      ['和别人在一起时我通常很自在', false],
      ['我会避免与别人接触', true],
      ['我习惯和别人保持距离', true],
    ],
  },
  {
    d: 'O',
    f: 'O1',
    name: '想象力',
    items: [
      ['我的想象力很丰富', false],
      ['我喜欢不受拘束地幻想', false],
      ['我喜欢做白日梦', false],
      ['我喜欢沉浸在自己的思绪中', false],
    ],
  },
  {
    d: 'A',
    f: 'A1',
    name: '信任',
    items: [
      ['我通常愿意信任别人', false],
      ['我相信大多数人抱有善意', false],
      ['我愿意相信别人说的话', false],
      ['我很难信任别人', true],
    ],
  },
  {
    d: 'C',
    f: 'C1',
    name: '效能感',
    items: [
      ['我能成功完成交给自己的任务', false],
      ['我通常能把自己做的事情做好', false],
      ['我能顺利处理大多数任务', false],
      ['我知道怎样把事情办成', false],
    ],
  },
  {
    d: 'N',
    f: 'N2',
    name: '易怒',
    items: [
      ['我很容易生气', false],
      ['我很容易被惹恼', false],
      ['我有时会控制不住脾气', false],
      ['我通常不会轻易恼火', true],
    ],
  },
  {
    d: 'E',
    f: 'E2',
    name: '合群',
    items: [
      ['我喜欢热闹的大型聚会', false],
      ['在聚会上我会和许多不同的人交谈', false],
      ['我更喜欢独处', true],
      ['我会避开拥挤的人群', true],
    ],
  },
  {
    d: 'O',
    f: 'O2',
    name: '艺术兴趣',
    items: [
      ['我相信艺术很重要', false],
      ['我能看到别人可能忽略的美', false],
      ['我不喜欢诗歌', true],
      ['我不享受参观美术馆或展览', true],
    ],
  },
  {
    d: 'A',
    f: 'A2',
    name: '真诚',
    items: [
      ['我会利用别人达到自己的目的', true],
      ['为了占优势，我可能会作弊', true],
      ['我会占别人的便宜', true],
      ['我会故意阻碍别人的计划', true],
    ],
  },
  {
    d: 'C',
    f: 'C2',
    name: '条理',
    items: [
      ['我喜欢整理和收拾东西', false],
      ['我常忘记把东西放回原位', true],
      ['我的房间或工作区经常很乱', true],
      ['我经常把物品随手乱放', true],
    ],
  },
  {
    d: 'N',
    f: 'N3',
    name: '低落',
    items: [
      ['我常感到情绪低落', false],
      ['我有时不喜欢自己', false],
      ['我经常提不起精神', false],
      ['我通常能自在地接纳自己', true],
    ],
  },
  {
    d: 'E',
    f: 'E3',
    name: '主导性',
    items: [
      ['需要时我会主动负责', false],
      ['我会尝试带领别人', false],
      ['我倾向主动掌控事情的进展', false],
      ['我通常等别人先带头', true],
    ],
  },
  {
    d: 'O',
    f: 'O3',
    name: '情感丰富',
    items: [
      ['我的情绪体验很强烈', false],
      ['我能感受到别人的情绪', false],
      ['我很少留意自己的情绪反应', true],
      ['我难以理解情绪反应强烈的人', true],
    ],
  },
  {
    d: 'A',
    f: 'A3',
    name: '利他',
    items: [
      ['我关心别人的处境', false],
      ['我喜欢帮助别人', false],
      ['我对别人的感受漠不关心', true],
      ['我不愿意为别人花时间', true],
    ],
  },
  {
    d: 'C',
    f: 'C3',
    name: '责任感',
    items: [
      ['我会遵守自己的承诺', false],
      ['我重视诚实地说出事实', false],
      ['我会随意破坏规则', true],
      ['我经常违背自己答应的事情', true],
    ],
  },
];
