import {Injectable} from '@angular/core';
import {Actions, createEffect, ofType} from '@ngrx/effects';
import {select, Store} from '@ngrx/store';
import {PersistenceService} from '../../../core/persistence/persistence.service';
import {
  addSimpleCounter,
  deleteSimpleCounter,
  deleteSimpleCounters,
  increaseSimpleCounterCounterToday,
  setSimpleCounterCounterOff,
  setSimpleCounterCounterOn,
  setSimpleCounterCounterToday,
  updateAllSimpleCounters,
  updateSimpleCounter,
  upsertSimpleCounter
} from './simple-counter.actions';
import {map, mergeMap, switchMap, tap, withLatestFrom} from 'rxjs/operators';
import {selectSimpleCounterFeatureState} from './simple-counter.reducer';
import {SimpleCounterState, SimpleCounterType} from '../simple-counter.model';
import {TimeTrackingService} from '../../time-tracking/time-tracking.service';
import {SimpleCounterService} from '../simple-counter.service';
import {EMPTY} from 'rxjs';
import {SIMPLE_COUNTER_TRIGGER_ACTIONS} from '../simple-counter.const';


@Injectable()
export class SimpleCounterEffects {

  updateSimpleCountersStorage$ = createEffect(() => this._actions$.pipe(
    ofType(
      updateAllSimpleCounters,
      setSimpleCounterCounterToday,
      increaseSimpleCounterCounterToday,
      setSimpleCounterCounterOn,
      setSimpleCounterCounterOff,
      // toggleSimpleCounterCounter,

      // currently not used
      addSimpleCounter,
      updateSimpleCounter,
      upsertSimpleCounter,
      deleteSimpleCounter,
      deleteSimpleCounters,
    ),
    withLatestFrom(
      this._store$.pipe(select(selectSimpleCounterFeatureState)),
    ),
    tap(([, featureState]) => this._saveToLs(featureState)),
  ), {dispatch: false});

  checkTimedCounters$ = createEffect(() => this._simpleCounterService.enabledAndToggledSimpleCounters$.pipe(
    switchMap((items) => (items && items.length)
      ? this._timeTrackingService.tick$.pipe(
        map(tick => ({tick, items}))
      )
      : EMPTY
    ),
    mergeMap(({items, tick}) => {
        return items.map(
          (item) => increaseSimpleCounterCounterToday({id: item.id, increaseBy: tick.duration})
        );
      }
    ),
  ));

  actionListeners$ = createEffect(() => this._simpleCounterService.enabledSimpleCountersUpdatedOnCfgChange$.pipe(
    map(items => items && items.filter(item =>
      (item.triggerOnActions && item.triggerOnActions.length)
      || (item.triggerOffActions && item.triggerOffActions.length)
    )),
    switchMap((items) => (items && items.length)
      ? this._actions$.pipe(
        ofType(...SIMPLE_COUNTER_TRIGGER_ACTIONS),
        map(action => ({action, items}))
      )
      : EMPTY
    ),
    mergeMap(({items, action}) => {
        const clickCounter = items.filter(item => item.type === SimpleCounterType.ClickCounter);
        const stopWatch = items.filter(item => item.type === SimpleCounterType.StopWatch);


        const startItems = stopWatch.filter(
          item => item.triggerOnActions && item.triggerOnActions.includes(action.type)
        );
        const counterUpItems = clickCounter.filter(
          item => item.triggerOnActions && item.triggerOnActions.includes(action.type)
        );
        const stopItems = stopWatch.filter(
          item => item.triggerOffActions && item.triggerOffActions.includes(action.type)
        );

        return [
          ...startItems.map(item => setSimpleCounterCounterOn({id: item.id})),
          ...stopItems.map(item => setSimpleCounterCounterOff({id: item.id})),
          ...counterUpItems.map(item => increaseSimpleCounterCounterToday({id: item.id, increaseBy: 1}))
        ];
      }
    ),
  ));


  constructor(
    private _actions$: Actions,
    private _store$: Store<any>,
    private _timeTrackingService: TimeTrackingService,
    private _persistenceService: PersistenceService,
    private _simpleCounterService: SimpleCounterService,
  ) {
  }

  private _saveToLs(simpleCounterState: SimpleCounterState) {
    this._persistenceService.saveLastActive();
    this._persistenceService.simpleCounter.saveState(simpleCounterState);
  }
}
