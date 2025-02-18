import * as THREE from 'three'

export enum FishState {
  WANDER = "wander",
  APPROACH = "approach",
  EAT = "eat",
  REST = "rest",
  TALK = "talk",
}

export interface FishBehaviorOptions {
  approachThreshold?: number;    // distance under which the fish is considered to have reached the target
  restDuration?: number;         // how long the fish remains in REST state (in seconds)
  eatDuration?: number;          // how long the eating animation lasts (in seconds)
  bounds?: { min: number; max: number }; // allowed X and Z range for targets
  onEat?: () => void;           // callback triggered when the fish finishes eating
}

export class FishBehavior {
  public state: FishState;
  public target: THREE.Vector3 | null;
  public targetQueue: THREE.Vector3[];
  private options: FishBehaviorOptions;
  private timer: number;
  
  // Single source of truth for stationary states (REST and TALK)
  public stationaryPosition: THREE.Vector3 | null;
  public stationaryDirection: THREE.Vector3 | null;

  // Temporary vector to reduce allocations
  private _tempVec: THREE.Vector3;

  constructor(options?: FishBehaviorOptions) {
    this.options = {
      approachThreshold: 0.5,
      restDuration: 2,
      eatDuration: 1,
      bounds: { min: -10, max: 10 },
      onEat: undefined,
      ...options,
    };
    this.state = FishState.TALK;
    this.target = null;
    this.targetQueue = [];
    this.stationaryPosition = null;
    this.stationaryDirection = null;
    this.timer = 0;
    this._tempVec = new THREE.Vector3();
  }

  /**
   * External method to set the food target.
   * Instead of overriding the current target if one exists, we queue additional food points.
   */
  public setFoodTarget(target: THREE.Vector3) {
    // If no current target, set it and transition (unless talking)
    if (!this.target) {
      this.target = target.clone();
      if (this.state !== FishState.TALK) {
        this.state = FishState.APPROACH;
        this.timer = 0;
      }
    } else {
      // Otherwise queue it
      this.targetQueue.push(target.clone());
    }
  }

  /**
   * Call this on every frame.
   * The update logic is:
   * - In APPROACH, if the fish is near the target, switch to EAT.
   * - In EAT, count elapsed time (allowing an eating animation to play), then call onEat and switch to REST.
   * - In REST, wait a little (simulate a pause), then:
   *   > If there is another food target queued, switch to APPROACH with that target.
   *   > Otherwise, return to WANDER.
   */
  public update(headPosition: THREE.Vector3, velocity: THREE.Vector3, deltaTime: number) {
    switch (this.state) {
      case FishState.APPROACH:
        if (this.target) {
          // Reuse the temporary vector instead of creating a new one
          this._tempVec.copy(headPosition).sub(this.target);
          if (this._tempVec.length() < this.options.approachThreshold!) {
            this.state = FishState.EAT;
            this.timer = 0;
          }
        }
        break;

      case FishState.EAT:
        this.timer += deltaTime;
        if (this.timer >= this.options.eatDuration!) {
          this.options.onEat?.();
          this.enterStationaryState(FishState.REST, headPosition, velocity);
        }
        break;

      case FishState.REST:
        this.timer += deltaTime;
        if (this.timer >= this.options.restDuration!) {
          this.exitStationaryState();
        }
        break;

      case FishState.WANDER:
        if (!this.target && this.targetQueue.length > 0) {
          this.target = this.targetQueue.shift()!;
          this.state = FishState.APPROACH;
          this.timer = 0;
        }
        break;

      case FishState.TALK:
        // Remains in TALK until explicitly stopped
        break;
    }
  }

  private enterStationaryState(state: FishState.REST | FishState.TALK, position: THREE.Vector3, velocity: THREE.Vector3) {
    this.stationaryPosition = position.clone();
    
    // Set direction, preferring current velocity if significant
    if (velocity.length() > 0.001) {
      this.stationaryDirection = velocity.clone().normalize();
    } else if (this.stationaryDirection) {
      // Keep existing direction
      this.stationaryDirection = this.stationaryDirection.clone();
    } else {
      // Default to forward
      this.stationaryDirection = new THREE.Vector3(0, 0, 1);
    }
    
    this.state = state;
    this.timer = 0;
  }

  private exitStationaryState() {
    if (this.targetQueue.length > 0) {
      this.target = this.targetQueue.shift()!;
      this.state = FishState.APPROACH;
    } else {
      this.state = FishState.WANDER;
      this.target = null;
    }
    this.stationaryPosition = null;
    this.stationaryDirection = null;
    this.timer = 0;
  }

  public startTalking(position: THREE.Vector3, velocity: THREE.Vector3) {
    if (this.state !== FishState.TALK) {
      this.enterStationaryState(FishState.TALK, position, velocity);
    }
  }

  public stopTalking() {
    if (this.state === FishState.TALK) {
      this.exitStationaryState();
    }
  }

  public resetTarget() {
    this.target = null;
    this.targetQueue = [];
    this.stationaryPosition = null;
    this.stationaryDirection = null;
    this.state = FishState.WANDER;
    this.timer = 0;
  }

  // Helper to check if we're in a stationary state
  public isStationary(): boolean {
    return this.state === FishState.REST || this.state === FishState.TALK;
  }
}